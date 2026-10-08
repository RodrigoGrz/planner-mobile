import { api } from "./api";
import { routes } from "./routes";

export type Register = {
  name: string;
  email: string;
  password: string;
  phone: string;
};

async function registerTraveler({ email, name, password, phone }: Register) {
  await api.post(routes.travelers(), {
    email,
    name,
    password,
    phone,
  });
}

export const registerServer = { registerTraveler };
