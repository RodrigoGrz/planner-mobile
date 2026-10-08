export const ERROR_MESSAGES = {
  network:
    "Sem conexão com o servidor. Verifique sua internet e tente novamente.",
  server: "Algo deu errado no servidor. Tente novamente em instantes.",
  invalidFields: (fields: string[]) =>
    `Verifique os campos: ${fields.join(", ")}.`,
  invalidData: "Verifique os dados informados.",
  forbidden: "Você não tem permissão para alterar esta viagem.",
  tripGone: "Esta viagem não existe mais e foi removida do aparelho.",
  rateLimited: "Muitas requisições, tentando novamente em instantes.",
  fileTooLarge: "A imagem é grande demais.",
  syncFailed: "Não foi possível sincronizar uma alteração.",
  sessionExpired:
    "Sua sessão expirou. Entre novamente para sincronizar suas alterações.",
  sessionExpiredWithoutChanges: "Sua sessão expirou. Entre novamente.",
  invalidActivityHour: "Informe um horário entre 0 e 23.",
  invalidDestination: "O destino deve ter entre 3 e 100 caracteres.",
  titleTooLong: "O título deve ter no máximo 100 caracteres.",
  invalidLink: "Link inválido. Use um endereço http ou https.",
  tooManyInvites: "Você pode convidar até 20 pessoas por viagem.",
  tripTooLong: "A viagem pode ter no máximo 30 dias.",
  startDateBeforeToday: "A data de início não pode ser anterior a hoje.",
  endDateBeforeToday: "A data de fim não pode ser anterior a hoje.",
  invalidName: "O nome deve ter entre 3 e 100 caracteres.",
  invalidEmail: "E-mail inválido.",
  duplicatedInvite: "E-mail já foi adicionado.",
  coverImagePreparationFailed: "Não foi possível preparar a imagem.",
  coverImageStillPreparing: "Aguarde a imagem ficar pronta.",
  outdatedApp:
    "Esta versão do app não é mais compatível com o servidor. Atualize o app.",
  requiredActivityFields: "Preencha todos os campos.",
  invalidPassword: "A senha deve ter entre 8 caracteres e 72 bytes.",
  invalidPhone: "Informe um telefone válido, com DDD.",
  syncFailures: (count: number) =>
    `${count} alterações não puderam ser sincronizadas.`,
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
