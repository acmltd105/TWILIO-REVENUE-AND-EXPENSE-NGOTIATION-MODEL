import { useQuery } from '@tanstack/react-query';
import { CatalogPayload, Sku } from '../lib/types';
import { z } from 'zod';

const ladderSchema = z.object({
  tier_a: z.number(),
  tier_b: z.number(),
  tier_c: z.number(),
});

const skuSchema = z.object({
  sku_id: z.string(),
  name: z.string(),
  category: z.string(),
  theme: z.string(),
  unit: z.string(),
  rack_rate: z.number().nonnegative(),
  contract_rate: z.number().nonnegative(),
  discount_rate: z.number().min(0).max(1),
  price_after_discount: z.number().nonnegative(),
  ladder: ladderSchema,
  locked: z.boolean(),
  notes: z.string().optional(),
});

const catalogSchema = z.object({
  generated_at: z.string(),
  skus: z.array(skuSchema).min(120),
});

const fetchCatalog = async (): Promise<Sku[]> => {
  const response = await fetch('/twilio_sku_catalog.json', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Unable to fetch catalog: ${response.statusText}`);
  }
  const payload = (await response.json()) as CatalogPayload;
  const parsed = catalogSchema.parse(payload);
  return parsed.skus;
};

export const useCatalog = () =>
  useQuery({
    queryKey: ['catalog'],
    queryFn: fetchCatalog,
  });
