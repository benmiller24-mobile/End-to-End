/**
 * Tenant entry point: registers the built-in lines (Eclipse, Shiloh) and
 * every data-only tenant package from the manifest, then re-exports the
 * registry API. Import this module (not registry.js) so registration has
 * always happened before lookups.
 */
import './builtin.js';
import { TENANT_PACKAGES } from './packages/manifest.js';
import { registerTenantPackage } from './registry.js';

for (const pkg of TENANT_PACKAGES) registerTenantPackage(pkg);

export {
  registerTenant, registerTenantPackage, buildTenantFromPackage,
  getTenant, listTenants, hasTenant,
  setActiveTenant, getActiveTenant, activeTenantId, removeTenant,
  setTenantPriceGroup, priceGroupForRange,
} from './registry.js';
