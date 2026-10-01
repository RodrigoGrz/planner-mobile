export const ERROR_MESSAGES = {
  network:
    "Sem conexão com o servidor. Verifique sua internet e tente novamente.",
  server: "Algo deu errado no servidor. Tente novamente em instantes.",
  invalidFields: (fields: string[]) =>
    `Verifique os campos: ${fields.join(", ")}.`,
  invalidData: "Verifique os dados informados.",
} as const;

export const FIELD_LABELS: Record<string, string> = {
  email: "e-mail",
  password: "senha",
  name: "nome",
  phone: "telefone",
  destination: "destino",
  startsAt: "data de início",
  endsAt: "data de fim",
  title: "título",
  url: "link",
  occursAt: "data da atividade",
  emailsToInvite: "e-mails dos convidados",
};
