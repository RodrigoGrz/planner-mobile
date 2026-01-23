import { z } from "zod"

function url(url: string) {
  const urlSchema = z.url()

  return urlSchema.safeParse(url).success
}

function email(email: string) {
  const emailSchema = z.email()

  return emailSchema.safeParse(email).success
}

export const validateInput = { url, email }