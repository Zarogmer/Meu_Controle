export const PRESET_PRODUCT_CATEGORIES = [
  'Roupas',
  'Calçados',
  'Acessórios',
  'Perfumaria',
  'Cosméticos',
  'Barbearia',
  'Cabeleireiro',
  'Eletrônicos',
  'Celulares',
  'Informática',
  'Bijuterias',
  'Papelaria',
  'Utilidades',
  'Casa e Decoração',
  'Alimentos',
  'Bebidas',
  'Suplementos',
  'Farmácia',
  'Presentes',
  'Outros',
] as const;

export function normalizeCategoryName(value: string) {
  return value.trim().toLocaleLowerCase('pt-BR');
}
