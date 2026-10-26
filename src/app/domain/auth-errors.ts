export function authErrorMessage(error:unknown,fallback:string):string {
 const detail=error as {code?:string;name?:string;message?:string}|null;
 const messages:Record<string,string>={
  email_not_confirmed:"Devi confermare l’indirizzo email prima di accedere. Puoi reinviare il link qui sotto.",
  invalid_credentials:"Email o password non corrette. Se non ricordi la password, usa Dimenticata?.",
  email_address_invalid:"Inserisci un indirizzo email valido.",
  email_address_not_authorized:"Il servizio email del sito non è ancora abilitato all’invio verso questo indirizzo. Contatta il gestore del sito.",
  over_email_send_rate_limit:"Limite di invio email raggiunto. Riprova più tardi.",
  over_request_rate_limit:"Troppe richieste ravvicinate. Attendi un minuto e riprova.",
  weak_password:"La password non soddisfa i requisiti richiesti. Usa almeno 8 caratteri e una combinazione meno comune.",
  user_already_exists:"Se hai già un account con questo indirizzo, accedi o recupera la password.",
  email_exists:"Se hai già un account con questo indirizzo, accedi o recupera la password.",
  signup_disabled:"La registrazione è temporaneamente indisponibile. Riprova più tardi.",
  email_provider_disabled:"L’accesso con email è temporaneamente indisponibile.",
  provider_disabled:"L’accesso con Google non è ancora disponibile. Usa email e password.",
  oauth_provider_not_supported:"L’accesso con Google non è ancora disponibile. Usa email e password.",
  otp_expired:"Il link è scaduto o è già stato usato. Richiedi un nuovo link.",
  bad_code_verifier:"Apri il link nello stesso browser usato per la richiesta. Se non funziona, richiedine uno nuovo.",
  flow_state_not_found:"Apri il link nello stesso browser usato per la richiesta. Se non funziona, richiedine uno nuovo.",
  same_password:"Scegli una password diversa da quella attuale.",
  captcha_failed:"La verifica anti-bot non è riuscita. Ricarica la pagina e riprova.",
  request_timeout:"Connessione al servizio di accesso non riuscita. Controlla la rete e riprova.",
 };
 if(detail?.code&&Object.hasOwn(messages,detail.code))return messages[detail.code];
 if(/error sending (?:confirmation|recovery|email)/i.test(detail?.message??""))return "Invio email non riuscito. Riprova più tardi o contatta il gestore del sito.";
 if(detail?.name==="AuthRetryableFetchError")return "Connessione al servizio di accesso non riuscita. Controlla la rete e riprova.";
 return fallback;
}
