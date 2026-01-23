import { api } from "./api";

export type Register = {
  name: string;
  email: string;
  password: string;
  phone: string;
};

async function registerTraveler({ email, name, password, phone }: Register) {
  try {
    await api.post("/travelers/register", {
      email,
      name,
      password,
      phone,
    });
  } catch (error) {
    throw error;
  }
}

export const registerServer = { registerTraveler };
