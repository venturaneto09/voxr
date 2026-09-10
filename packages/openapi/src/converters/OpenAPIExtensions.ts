// SPDX-License-Identifier: AGPL-3.0-or-later
import type {BitflagEntry, EnumEntry} from '@voxr/openapi/src/converters/ZodToOpenAPIAnnotationParser';
import type {OpenAPISchema} from '@voxr/openapi/src/Types';

export interface VoxrOpenAPIExtensions {
	'x-enumNames'?: Array<string | null>;
	'x-enumDescriptions'?: Array<string | null>;
	'x-bitflagValues'?: Array<BitflagEntry>;
	'x-keyType'?: 'snowflake';
}

export type OpenAPISchemaWithExtensions = OpenAPISchema & VoxrOpenAPIExtensions;

function withVoxrExtensions(schema: OpenAPISchema): OpenAPISchemaWithExtensions {
	return schema as OpenAPISchemaWithExtensions;
}

export function setEnumNames(schema: OpenAPISchema, names: Array<string | null>): void {
	withVoxrExtensions(schema)['x-enumNames'] = names;
}

export function setEnumDescriptions(schema: OpenAPISchema, descriptions: Array<string | null>): void {
	withVoxrExtensions(schema)['x-enumDescriptions'] = descriptions;
}

export function setBitflagValues(schema: OpenAPISchema, values: Array<BitflagEntry>): void {
	withVoxrExtensions(schema)['x-bitflagValues'] = values;
}

export function setSnowflakeKeyType(schema: OpenAPISchema): void {
	withVoxrExtensions(schema)['x-keyType'] = 'snowflake';
}

export function getEnumDescriptions(entries: Array<EnumEntry>): Array<string | null> | null {
	const descriptions = entries.map((entry) => entry.description ?? null);
	return descriptions.some((description) => description != null) ? descriptions : null;
}

export function getNumericEnumValues(entries: Array<EnumEntry>): Array<number> | null {
	const values: Array<number> = [];
	for (const entry of entries) {
		if (typeof entry.value !== 'number') {
			return null;
		}
		values.push(entry.value);
	}
	return values;
}

export function applyEnumEntryExtensions(schema: OpenAPISchema, entries: Array<EnumEntry>): boolean {
	const enumValues = getNumericEnumValues(entries);
	if (!enumValues) {
		return false;
	}
	schema.enum = enumValues;
	setEnumNames(
		schema,
		entries.map((entry) => entry.name),
	);
	const descriptions = getEnumDescriptions(entries);
	if (descriptions) {
		setEnumDescriptions(schema, descriptions);
	}
	return true;
}
