// SPDX-License-Identifier: AGPL-3.0-or-later
import {
	Base64ImageTypeRef,
	DiscriminatorTypeRef,
	EmailTypeRef,
	Int32TypeRef,
	Int64StringTypeRef,
	Int64TypeRef,
	LocaleRef,
	NonNegativeSafeIntegerTypeRef,
	PasswordTypeRef,
	PhoneNumberTypeRef,
	SnowflakeTypeRef,
	UnsignedInt64TypeRef,
	UsernameTypeRef,
} from '@voxr/openapi/src/converters/BuiltInSchemas';
import {applyEnumEntryExtensions, setBitflagValues} from '@voxr/openapi/src/converters/OpenAPIExtensions';
import {getCustomTypeMetadata, getZodParent} from '@voxr/openapi/src/converters/ZodInternals';
import {
	type VoxrTypeAnnotation,
	parseVoxrTypeAnnotation,
} from '@voxr/openapi/src/converters/ZodToOpenAPIAnnotationParser';
import {
	getDescription,
	getInnerType,
	getOptions,
	getZodTypeName,
	isStringNumberIntUnion,
} from '@voxr/openapi/src/converters/ZodToOpenAPIIntrospection';
import {CustomSchemaType} from '@voxr/openapi/src/schemas/CustomSchemaType';
import type {OpenAPISchema, OpenAPISchemaOrRef} from '@voxr/openapi/src/Types';
import type {ZodTypeAny} from 'zod';

const bitflagSchemaRegistry = new Map<string, OpenAPISchema>();
const int32EnumSchemaRegistry = new Map<string, OpenAPISchema>();
function getCustomType(schema: ZodTypeAny, depth = 0): string | undefined {
	if (depth > 20) return undefined;
	const direct = getCustomTypeMetadata(schema);
	if (typeof direct === 'string') return direct;
	const parent = getZodParent(schema);
	if (parent) {
		return getCustomType(parent, depth + 1);
	}
	return undefined;
}
function getRefForCustomTypeName(typeName: string): OpenAPISchemaOrRef | null {
	const registryRef = CustomSchemaType.getRef(typeName);
	if (registryRef) return registryRef;
	switch (typeName) {
		case 'SnowflakeType':
		case 'SnowflakeStringType':
			return SnowflakeTypeRef;
		case 'Int32Type':
			return Int32TypeRef;
		case 'NonNegativeSafeIntegerType':
			return NonNegativeSafeIntegerTypeRef;
		case 'Int64Type':
			return Int64TypeRef;
		case 'Int64StringType':
			return Int64StringTypeRef;
		case 'UnsignedInt64Type':
			return UnsignedInt64TypeRef;
		case 'UsernameType':
			return UsernameTypeRef;
		case 'DiscriminatorType':
			return DiscriminatorTypeRef;
		case 'EmailType':
			return EmailTypeRef;
		case 'PasswordType':
			return PasswordTypeRef;
		case 'PhoneNumberType':
			return PhoneNumberTypeRef;
		case 'Base64ImageType':
			return Base64ImageTypeRef;
		case 'Locale':
			return LocaleRef;
		default:
			return null;
	}
}
function makeSchemaRef(schemaName: string, description: string | undefined): OpenAPISchemaOrRef {
	if (description) {
		return {$ref: `#/components/schemas/${schemaName}`, description};
	}
	return {$ref: `#/components/schemas/${schemaName}`};
}
function applyInt32EnumEntries(schema: OpenAPISchema, voxr: VoxrTypeAnnotation): void {
	if (!voxr.enumEntries || voxr.enumEntries.length === 0) {
		return;
	}
	applyEnumEntryExtensions(schema, voxr.enumEntries);
}
function makeInt32EnumSchema(voxr: VoxrTypeAnnotation): OpenAPISchema {
	const schema: OpenAPISchema = {type: 'integer', format: 'int32'};
	applyInt32EnumEntries(schema, voxr);
	if (voxr.userDescription) {
		schema.description = voxr.userDescription;
	}
	return schema;
}
function getInt32EnumSchema(voxr: VoxrTypeAnnotation): OpenAPISchemaOrRef {
	if (!voxr.bitflagTypeName) {
		return makeInt32EnumSchema(voxr);
	}
	const schemaName = voxr.bitflagTypeName;
	if (!int32EnumSchemaRegistry.has(schemaName)) {
		int32EnumSchemaRegistry.set(schemaName, makeInt32EnumSchema(voxr));
	}
	return makeSchemaRef(schemaName, voxr.fieldDescription);
}
function makeBitflagSchema(voxr: VoxrTypeAnnotation, integer: boolean): OpenAPISchema {
	const schema: OpenAPISchema = integer
		? {type: 'integer', format: 'int32', minimum: 0, maximum: 2147483647}
		: {type: 'string', format: 'int64', pattern: '^[0-9]+$'};
	if (voxr.bitflagValues && voxr.bitflagValues.length > 0) {
		setBitflagValues(schema, voxr.bitflagValues);
	}
	if (voxr.userDescription) {
		schema.description = voxr.userDescription;
	}
	return schema;
}
function getBitflagSchema(voxr: VoxrTypeAnnotation, integer: boolean): OpenAPISchemaOrRef {
	if (!voxr.bitflagTypeName) {
		return makeBitflagSchema(voxr, integer);
	}
	const schemaName = voxr.bitflagTypeName;
	if (!bitflagSchemaRegistry.has(schemaName)) {
		bitflagSchemaRegistry.set(schemaName, makeBitflagSchema(voxr, integer));
	}
	return makeSchemaRef(schemaName, voxr.fieldDescription);
}
export function getVoxrCustomTypeSchema(schema: ZodTypeAny, depth = 0): OpenAPISchemaOrRef | null {
	if (depth > 15) return null;
	const customType = getCustomType(schema);
	if (customType) {
		const ref = getRefForCustomTypeName(customType);
		if (ref) return ref;
	}
	const description = getDescription(schema);
	const voxr = parseVoxrTypeAnnotation(description);
	if (voxr) {
		const ref = getRefForCustomTypeName(voxr.typeName);
		if (ref) return ref;
		if (voxr.typeName === 'Int32Enum') {
			return getInt32EnumSchema(voxr);
		}
		if (voxr.typeName === 'Bitflags64') {
			return getBitflagSchema(voxr, false);
		}
		if (voxr.typeName === 'Bitflags32') {
			return getBitflagSchema(voxr, true);
		}
		if (voxr.typeName === 'Permissions') {
			return getBitflagSchema(voxr, false);
		}
		const customSchema = VOXR_CUSTOM_TYPES[voxr.typeName];
		return customSchema ? {...customSchema} : null;
	}
	const zodTypeName = getZodTypeName(schema);
	if (zodTypeName === 'ZodEffects' || zodTypeName === 'effect' || zodTypeName === 'pipe') {
		const inner = getInnerType(schema);
		if (inner) {
			const innerType = getZodTypeName(inner);
			if (innerType === 'ZodUnion' || innerType === 'union') {
				const options = getOptions(inner);
				if (isStringNumberIntUnion(options)) {
					return SnowflakeTypeRef;
				}
			}
			const innerCustomSchema = getVoxrCustomTypeSchema(inner, depth + 1);
			if (innerCustomSchema) {
				return innerCustomSchema;
			}
		}
	}
	if (
		zodTypeName === 'ZodPipeline' ||
		zodTypeName === 'pipe' ||
		zodTypeName === 'ZodOptional' ||
		zodTypeName === 'optional' ||
		zodTypeName === 'ZodDefault' ||
		zodTypeName === 'default'
	) {
		const inner = getInnerType(schema);
		if (inner) {
			const innerCustomSchema = getVoxrCustomTypeSchema(inner, depth + 1);
			if (innerCustomSchema) {
				return innerCustomSchema;
			}
		}
	}
	return null;
}
export function isSnowflakeType(schema: ZodTypeAny, depth = 0): boolean {
	if (depth > 10) return false;
	const customTypeSchema = getVoxrCustomTypeSchema(schema, depth);
	if (customTypeSchema === SnowflakeTypeRef) {
		return true;
	}
	const zodTypeName = getZodTypeName(schema);
	if (
		zodTypeName === 'ZodEffects' ||
		zodTypeName === 'effect' ||
		zodTypeName === 'ZodPipeline' ||
		zodTypeName === 'pipe'
	) {
		const inner = getInnerType(schema);
		if (inner) {
			return isSnowflakeType(inner, depth + 1);
		}
	}
	return false;
}
const VOXR_CUSTOM_TYPES: Record<string, OpenAPISchema> = {
	Int64Type: {type: 'string', format: 'int64', pattern: '^-?[0-9]+$'},
	Int64StringType: {type: 'string', format: 'int64', pattern: '^-?[0-9]+$'},
	UnsignedInt64Type: {type: 'string', format: 'int64', pattern: '^[0-9]+$'},
	PermissionStringType: {type: 'string', format: 'int64', pattern: '^[0-9]+$'},
	BitflagStringType: {type: 'string', format: 'int64', pattern: '^[0-9]+$'},
	ColorType: {type: 'integer', minimum: 0, maximum: 16777215, format: 'int32'},
	Int32Type: {type: 'integer', minimum: 0, maximum: 2147483647, format: 'int32'},
	NonNegativeSafeIntegerType: {type: 'integer', minimum: 0, maximum: 9007199254740991, format: 'int53'},
	EmailType: {type: 'string', format: 'email'},
	PasswordType: {type: 'string', minLength: 8, maxLength: 256},
	UsernameType: {type: 'string', minLength: 1, maxLength: 32, pattern: '^[a-zA-Z0-9_]+$'},
	PhoneNumberType: {type: 'string', pattern: '^\\+[1-9]\\d{1,14}$'},
	URLType: {type: 'string', format: 'uri'},
	QueryBooleanType: {type: 'boolean'},
	DateTimeType: {type: 'string', format: 'date-time'},
	SnowflakeType: {
		type: 'string',
		format: 'snowflake',
		pattern: '^(0|[1-9][0-9]*)$',
	},
	SnowflakeStringType: {
		type: 'string',
		format: 'snowflake',
		pattern: '^(0|[1-9][0-9]*)$',
	},
};
export function getRegisteredBitflagSchemas(): Record<string, OpenAPISchema> {
	const result: Record<string, OpenAPISchema> = {};
	for (const [name, schema] of bitflagSchemaRegistry) {
		result[name] = schema;
	}
	return result;
}
export function getRegisteredInt32EnumSchemas(): Record<string, OpenAPISchema> {
	const result: Record<string, OpenAPISchema> = {};
	for (const [name, schema] of int32EnumSchemaRegistry) {
		result[name] = schema;
	}
	return result;
}
