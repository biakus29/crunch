export const normalizePhone = (input) => {
  const cleaned = input.replace(/[\D\s]/g, "");
  const variations = [
    `+237${cleaned.replace(/^237/, "")}`,
    cleaned,
    `+${cleaned}`,
    cleaned.replace(/^237/, ""),
    input,
  ].filter((v, i, arr) => v && arr.indexOf(v) === i && v.length >= 9);
  return variations;
};