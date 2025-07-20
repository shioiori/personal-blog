export async function getMessages(locale: string) {
  return {
    ...(await import(`../../messages/${locale}/common.json`)).default,
    ...(await import(`../../messages/${locale}/aboutme.json`)).default,
    ...(await import(`../../messages/${locale}/blog.json`)).default,
    ...(await import(`../../messages/${locale}/music.json`)).default,
    ...(await import(`../../messages/${locale}/home.json`)).default,
    ...(await import(`../../messages/${locale}/project.json`)).default
  };
}
