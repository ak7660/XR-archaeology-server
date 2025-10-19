import { useAuth } from "@/contexts/auth";
import { useRef, useState } from "react";
import { useRouter } from "next/router";
import { useHeaderContext } from "@/contexts/header";
import { useTranslation } from "react-i18next";

const LoginPage = () => {
  const { t } = useTranslation();
  const { login } = useAuth();
  const router = useRouter();
  const { setTitle } = useHeaderContext();
  const email = useRef("");
  const password = useRef("");
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (formRef.current) {
      const formElement = formRef.current as HTMLFormElement;
      const isValid = formElement.checkValidity();

      const firstInvalidField = formElement.querySelector(":invalid") as HTMLInputElement;
      firstInvalidField?.focus();
      try {
        setLoading(true);
        if (isValid) {
          await login({ email: email.current, password: password.current });
          await router.replace("/attractions");
          setTitle("APSAP");
        } else {
          setError("Invalid login");
        }
      } catch (error) {
        setError(`${error.message}`);
        console.warn(error);
      } finally {
        setLoading(false);
      }
    }
  };
  return (
    <div className="flex flex-col h-full w-full  ">
      <div className="flex flex-col h-screen max-w-full relative items-center justify-center bg-gradient-to-tr from-indigo-800 via-blue-500 bg-teal-400">
        <div className="md:w-5/12 w-11/12 bg-white rounded-2xl overflow-hidden p-4 md:p-12 ">
          <div className="flex flex-col w-full justify-center scrollable overflow-y-auto">
            <div className="my-6 mx-4 md:mx-8 flex flex-col gap-8">
              <h1 style={{ fontSize: 40 }}>Login</h1>
              <form ref={formRef}>
                <div className="flex flex-col gap-6">
                  <div>
                    <label className="mb-2">{t("basic.email")}</label>
                    <input
                      placeholder={t("basic.email")}
                      defaultValue={email.current}
                      type="email"
                      onChange={(e) => {
                        const value = e.target.value;
                        const isValid =
                          /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(
                            value
                          );
                        if (!isValid) {
                          e.target.setCustomValidity("Please enter a valid email.");
                          e.target.reportValidity();
                        } else {
                          e.target.setCustomValidity("");
                        }
                        if (error && error.length) setError("");
                        email.current = value;
                      }}
                    />
                  </div>
                  <div>
                    <label className="mb-2">{t("basic.password")}</label>
                    <input
                      placeholder={t("basic.password")}
                      defaultValue={password.current}
                      type="password"
                      onChange={(e) => {
                        const value = e.target.value;
                        const isValid = value && value.length >= 8;
                        if (!isValid) {
                          e.target.setCustomValidity("Password must be in length of at least 8 characters");
                          e.target.reportValidity();
                        } else {
                          e.target.setCustomValidity("");
                        }
                        if (error && error.length) setError("");
                        password.current = value;
                      }}
                    />
                  </div>
                </div>
              </form>
              <div className="flex flex-col">
                <button
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 min-w-24 rounded"
                  disabled={loading}
                  type="button"
                  onClick={handleSubmit}
                >
                  {t("basic.login")}
                </button>
                {error && error.length && <p className="text-red-500 ">{error}</p>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
