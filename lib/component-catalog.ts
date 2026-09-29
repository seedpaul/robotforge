import { hardwareCatalog } from './hardware-catalog';
import { motorCatalog } from './motor-catalog';

// Motor profiles use the existing motor schema and generators, never passive device records.
export const componentCatalog = [
 ...motorCatalog.map(m => ({...m, id:`motor-${m.type}`, kind:'motor' as const, category:'Motor controllers', brands:m.brands || [m.brand]})),
 ...hardwareCatalog.map(d => ({...d, kind:'device' as const, brands:[d.brand]})),
];
export const componentBrands = [...new Set(componentCatalog.flatMap(d => d.brands))].sort();
export const componentCategories = [...new Set(componentCatalog.map(d => d.category))];
export function filterComponents(search = '', brand = 'all', category = 'all') {
 const normalize = (s:string) => s.toLowerCase().replace(/[^a-z0-9]/g,'');
 const terms = search.trim().split(/\s+/).map(normalize).filter(Boolean);
 return componentCatalog.filter(d => (brand === 'all' || d.brands.includes(brand)) && (category === 'all' || d.category === category) && terms.every(term => normalize(`${d.name} ${d.brands.join(' ')} ${d.category} ${d.connection} ${d.description}`).includes(term)));
}
