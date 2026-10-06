import { z } from "zod"

export const MAX_DESTINATION_LENGTH = 100
export const MAX_TITLE_LENGTH = 100
export const MAX_URL_LENGTH = 2048
export const MAX_EMAIL_LENGTH = 254
export const MAX_NAME_LENGTH = 100
export const MAX_PHONE_LENGTH = 20
export const MAX_INVITES = 20

const MIN_DESTINATION_LENGTH = 3
const MIN_NAME_LENGTH = 3
const MIN_PASSWORD_LENGTH = 8
const MAX_PASSWORD_BYTES = 72
const MIN_PHONE_DIGITS = 10
const PHONE_PATTERN = /^[\d+\s()-]+$/

function hasTrimmedLength(value: string, min: number, max: number) {
  const length = value.trim().length

  return length >= min && length <= max
}

function url(value: string) {
  return z.httpUrl().max(MAX_URL_LENGTH).safeParse(value.trim()).success
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

function email(value: string) {
  return z.email().max(MAX_EMAIL_LENGTH).safeParse(normalizeEmail(value)).success
}

function destination(value: string) {
  return hasTrimmedLength(value, MIN_DESTINATION_LENGTH, MAX_DESTINATION_LENGTH)
}

function itemTitle(value: string) {
  return hasTrimmedLength(value, 1, MAX_TITLE_LENGTH)
}

function personName(value: string) {
  return hasTrimmedLength(value, MIN_NAME_LENGTH, MAX_NAME_LENGTH)
}

function password(value: string) {
  return (
    value.length >= MIN_PASSWORD_LENGTH &&
    new TextEncoder().encode(value).length <= MAX_PASSWORD_BYTES
  )
}

function phone(value: string) {
  const trimmed = value.trim()

  return (
    trimmed.length <= MAX_PHONE_LENGTH &&
    PHONE_PATTERN.test(trimmed) &&
    trimmed.replace(/\D/g, "").length >= MIN_PHONE_DIGITS
  )
}

export const validateInput = {
  url,
  email,
  normalizeEmail,
  destination,
  itemTitle,
  personName,
  password,
  phone,
}
