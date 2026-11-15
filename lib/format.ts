export const formatVnd = (value: number | undefined | null) => {
  const safe = Number.isFinite(value) ? Math.round(Number(value)) : 0;
  return `${new Intl.NumberFormat("vi-VN").format(safe)}đ`;
};
