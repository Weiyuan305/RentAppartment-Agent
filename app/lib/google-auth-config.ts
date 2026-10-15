export type GoogleCredentials = {clientId:string;clientSecret:string};

// Server-only configuration. Never pass credentials through client props.
export function googleCredentials():GoogleCredentials | undefined {
  const clientId = process.env.ATLAS_GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.ATLAS_GOOGLE_CLIENT_SECRET?.trim();
  return clientId && clientSecret ? {clientId,clientSecret} : undefined;
}
