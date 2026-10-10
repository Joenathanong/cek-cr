export function cekKekuatan(pw) {
  if (!pw || pw.length < 8) return 'Password minimal 8 karakter.';
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'Password harus berisi huruf dan angka.';
  return null;
}
