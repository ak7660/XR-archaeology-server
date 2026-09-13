/**
 * `GET /api/eventAvailability/:eventId` - which days of an event can be booked
 * and how many places are left on each. Public: it reveals counts only, never
 * who booked.
 */
import * as errors from "@feathersjs/errors";
import { bookableDays, bookedPeople } from "@/server/feathers/bookings";

class EventAvailabilityService {
  app: any;

  setup(app: any) {
    this.app = app;
  }

  async get(id: any) {
    let event: any;
    try {
      event = await this.app.service("events").get(id);
    } catch {
      throw new errors.NotFound("This event is no longer available.");
    }
    const days = bookableDays(event);
    const bookingEnabled = event.bookingEnabled !== false;
    const capacity: number | null = event.capacity || null;
    const taken = capacity && days.length ? await bookedPeople(event._id) : {};
    return {
      event: String(event._id),
      bookingEnabled,
      capacity,
      ended: !days.length,
      days: days.map((day) => ({ day, left: capacity ? Math.max(0, capacity - (taken[day] || 0)) : null })),
    };
  }
}

export default new EventAvailabilityService();
