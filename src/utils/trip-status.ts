import { compareTripDayWithToday } from "@/utils/trip-dates";

export function getTripStatus(startsAt: string, endsAt: string) {
  const position = compareTripDayWithToday(startsAt, endsAt);

  const isFinished = position === "after";
  const isStarted = position === "during";

  return {
    label: isFinished ? "Realizada" : isStarted ? "Em andamento" : "Pendente",
    color: isFinished
      ? "bg-lime-400"
      : isStarted
        ? "bg-yellow-400"
        : "bg-red-400",
    textColor: "text-zinc-900",
  };
}
