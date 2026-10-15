const errors:Record<string,string> = {
  access_denied:"你已取消 Google 登录，可以重试或使用邮箱登录。",
  account_not_linked:"这个邮箱已有账号，请先用原密码登录，再绑定 Google，保留已有收藏和记录。",
  email_does_not_match:"请选择与当前账号邮箱一致的 Google 账号。",
  account_already_linked_to_different_user:"这个 Google 账号已关联其他账号，请使用原有登录方式。",
  state_not_found:"登录已过期，请重新点击 Google 登录。",
  state_mismatch:"登录已过期，请重新点击 Google 登录。",
  state_expired:"登录已过期，请重新点击 Google 登录。",
  invalid_code:"Google 登录未完成，请重新尝试。",
  PROVIDER_NOT_FOUND:"Google 登录暂时不可用，请使用邮箱登录或游客体验。",
  oauth_provider_not_found:"Google 登录暂时不可用，请使用邮箱登录或游客体验。",
};

export function oauthErrorMessage(code?:string) {
  return code ? errors[code] ?? "Google 登录未完成，请重试或使用邮箱登录。" : "";
}
