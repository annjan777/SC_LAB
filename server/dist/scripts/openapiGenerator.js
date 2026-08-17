import fs from 'fs';
import path from 'path';
export function generateOpenApiSpec() {
    return {
        openapi: '3.0.3',
        info: {
            title: 'SC Lab Management Portal API',
            version: '1.0.0',
            description: 'Production OpenAPI contract specification for SC Lab Portal Express API',
        },
        servers: [
            {
                url: 'http://localhost:3001',
                description: 'Local Development Server',
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
            },
            schemas: {
                ErrorResponse: {
                    type: 'object',
                    properties: {
                        error: { type: 'string' },
                        details: { type: 'array', items: { type: 'object' } },
                    },
                },
                UserPermissions: {
                    type: 'object',
                    properties: {
                        role_id: { type: 'string', format: 'uuid' },
                        user_role: { type: 'string' },
                        direct_permissions: { type: 'array', items: { type: 'object' } },
                    },
                },
            },
        },
        paths: {
            '/api/auth/login': {
                post: {
                    summary: 'User Login',
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    required: ['email', 'password'],
                                    properties: {
                                        email: { type: 'string', format: 'email' },
                                        password: { type: 'string' },
                                    },
                                },
                            },
                        },
                    },
                    responses: {
                        200: { description: 'Successful login returning JWT token and profile' },
                        400: { description: 'Validation failed' },
                        401: { description: 'Invalid credentials' },
                    },
                },
            },
            '/api/auth/signup': {
                post: {
                    summary: 'User Registration',
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    required: ['email', 'password', 'full_name'],
                                    properties: {
                                        email: { type: 'string', format: 'email' },
                                        password: { type: 'string', minLength: 8 },
                                        full_name: { type: 'string' },
                                    },
                                },
                            },
                        },
                    },
                    responses: {
                        201: { description: 'User account registered successfully' },
                        400: { description: 'Validation failed' },
                    },
                },
            },
            '/api/auth/me': {
                get: {
                    summary: 'Get Active User Session',
                    security: [{ bearerAuth: [] }],
                    responses: {
                        200: { description: 'User session and permissions retrieved' },
                        401: { description: 'Unauthorized' },
                    },
                },
            },
            '/api/admin/users/{id}/permissions': {
                get: {
                    summary: 'Get User Role & Permissions',
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
                    ],
                    responses: {
                        200: { description: 'User permissions object' },
                    },
                },
                put: {
                    summary: 'Update User Role & Direct Permissions',
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
                    ],
                    responses: {
                        200: { description: 'Permissions updated successfully' },
                    },
                },
            },
        },
    };
}
export function writeOpenApiSpec() {
    const spec = generateOpenApiSpec();
    const targetPath = path.join(process.cwd(), 'openapi.json');
    fs.writeFileSync(targetPath, JSON.stringify(spec, null, 2));
    console.log(`[OPENAPI] Specification generated successfully at: ${targetPath}`);
}
if (process.argv[1]?.endsWith('openapiGenerator.ts') || process.argv[1]?.endsWith('openapiGenerator.js')) {
    writeOpenApiSpec();
}
