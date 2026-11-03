/**
 * Validation for project inventory services (name, description, url, tags).
 */

import { SERVICE_CONFIG } from '@/lib/config/constants';
import { ValidationError } from './errors';
import {
  type JsonObject,
  readOptionalString,
  readOptionalStringArray,
  readOptionalUrl,
  readRequiredString,
} from './input';

export interface ServicePatch {
  name?: string;
  description?: string;
  url?: string;
  tags?: string[];
}

const NAME_OPTIONS = { max: SERVICE_CONFIG.NAME_MAX_LENGTH };

function readServiceDetails(body: JsonObject): Omit<ServicePatch, 'name'> {
  return {
    description: readOptionalString(body, 'description', 'Description', {
      max: SERVICE_CONFIG.DESCRIPTION_MAX_LENGTH,
    }),
    url: readOptionalUrl(body, 'url', 'URL', SERVICE_CONFIG.URL_MAX_LENGTH),
    tags: readOptionalStringArray(body, 'tags', 'Tags', {
      maxItems: SERVICE_CONFIG.MAX_TAGS,
      maxLength: SERVICE_CONFIG.TAG_MAX_LENGTH,
    }),
  };
}

export function parseServiceCreate(body: JsonObject): ServicePatch & { name: string } {
  return {
    name: readRequiredString(body, 'name', 'Service name', NAME_OPTIONS),
    ...readServiceDetails(body),
  };
}

export function parseServicePatch(body: JsonObject): ServicePatch {
  const name = readOptionalString(body, 'name', 'Service name', NAME_OPTIONS);
  if (name === '') throw new ValidationError('Service name cannot be empty');

  const patch: ServicePatch = { name, ...readServiceDetails(body) };
  if (Object.values(patch).every((value) => value === undefined)) {
    throw new ValidationError('No changes provided');
  }
  return patch;
}
