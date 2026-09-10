// SPDX-License-Identifier: AGPL-3.0-or-later
import type {OpenAPIGenerationResult, OpenAPIGeneratorOptions} from '@voxr/openapi/src/OpenAPIGenerationTypes';
import {OpenAPIGenerator} from '@voxr/openapi/src/OpenAPIGenerator';
export async function generateOpenAPISpec(options: OpenAPIGeneratorOptions): Promise<OpenAPIGenerationResult> {
	const generator = new OpenAPIGenerator(options);
	return generator.generateWithStats();
}
