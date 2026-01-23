import dayjs from "dayjs";

export function getTripStatus(startsAt: string, endsAt: string) {
  const today = dayjs();

  const isPending = today.isBefore(dayjs(startsAt), "day");
  const isFinished = today.isAfter(dayjs(endsAt), "day");
  const isStarted = !isPending && !isFinished;

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
