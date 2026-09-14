/**
 * `GET /api/eventAvailability/:eventId` - whether an event can be booked and how
 * many places are left. Public: it reveals counts only, never who booked.
 */
import * as errors from "@feathersjs/errors";
import { eventEnded, placesTaken } from "@/server/feathers/bookings";

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
    const capacity: number | null = event.capacity || null;
    const ended = eventEnded(event);
    return {
      event: String(event._id),
      bookingEnabled: event.bookingEnabled !== false,
      ended,
      capacity,
      /** Places left; null when the event has no limit. */
      left: capacity ? Math.max(0, capacity - (await placesTaken(event._id))) : null,
    };
  }
}

export default new EventAvailabilityService();
