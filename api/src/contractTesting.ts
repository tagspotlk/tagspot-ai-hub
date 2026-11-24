import { fileURLToPath } from 'node:url';
import SwaggerParser from '@apidevtools/swagger-parser';
import { Ajv2020 } from 'ajv/dist/2020.js';

/** Resolved from this package, not the process cwd, so any workspace can call it. */
const OPENAPI_PATH = fileURLToPath(new URL('../openapi.yaml', import.meta.url));
const JSON_MEDIA_TYPE = 'application/json';

export interface ResponseCheck {
  path: string;
  method: 'get';
  status: number;
  body: unknown;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

interface ResponseObject {
  content?: Record<string, { schema?: object }>;
}

interface ContractDocument {
  paths?: Record<string, Record<string, { responses?: Record<string, ResponseObject> }>>;
}

function failure(message: string): ValidationResult {
  return { valid: false, errors: [message] };
}

function findResponseSchema(document: ContractDocument, check: ResponseCheck): object | undefined {
  const operation = document.paths?.[check.path]?.[check.method];
  return operation?.responses?.[String(check.status)]?.content?.[JSON_MEDIA_TYPE]?.schema;
}

/** Validates a response body against the response schema declared in api/openapi.yaml. */
export async function validateResponse(check: ResponseCheck): Promise<ValidationResult> {
  const document = (await SwaggerParser.dereference(OPENAPI_PATH)) as ContractDocument;
  const schema = findResponseSchema(document, check);
  if (!schema) {
    return failure(`No response schema for ${check.method} ${check.path} ${check.status}`);
  }
  const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
  const valid = validate(check.body);
  const errors = (validate.errors ?? []).map((error) =>
    `${error.instancePath || '/'} ${error.message ?? ''}`.trim(),
  );
  return { valid, errors };
}
