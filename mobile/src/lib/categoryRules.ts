import { Category } from "./types";

export function categoryKind(
  category: Category,
): "income" | "expense" | "both" {
  if (category.kind) return category.kind;
  // Compatibility with saved demonstrations created before typed categories.
  if (/^(salário|salario|outras receitas)$/i.test(category.name))
    return "income";
  if (
    /^(transporte|alimentação|moradia|saúde|lazer|educação|outros)$/i.test(
      category.name,
    )
  )
    return "expense";
  return "both";
}
export function acceptsCategory(category: Category, kind: string) {
  return (
    !category.archived &&
    (categoryKind(category) === "both" || categoryKind(category) === kind)
  );
}
