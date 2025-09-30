import { version } from 'mongoose';
import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

// Swagger definition
const swaggerDefinition = {
  openapi: '3.1.0',
  info: {
    title: 'Prompt Sharing Community API',
    version: '1.0.0',
    description: 'A comprehensive API for AI prompt sharing community with subscription management',
    contact: {
      name: 'API Support',
      email: 'promptpalcommunity@gmail.com'
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT'
    }
  },
  servers: [
    {
      url: 'http://localhost:8000/api',
      description: 'Development server'
    },
    {
      url: 'https://promptpal-backend-j5gl.onrender.com/api',
      description: 'Production server'
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      }
    },
    schemas: {
      User: {
        type: 'object',
        required: ['username', 'email', 'password'],
        properties: {
          _id: {
            type: 'string',
            description: 'Auto-generated user ID'
          },
          name: {
            type: 'string',
            description: 'User full name'
          },
          username: {
            type: 'string',
            minLength: 3,
            maxLength: 30,
            description: 'Unique username'
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'User email address'
          },
          profession: {
            type: 'string',
            enum: ['Developer', 'Marketer', 'Designer', 'Content Writer', 'Other'],
            default: 'Other'
          },
          level: {
            type: 'string',
            enum: ['Newbie', 'Contributor', 'Pro', 'Expert'],
            default: 'Newbie'
          },
          avatar: {
            type: 'string',
            description: 'Profile picture URL'
          },
          isVerified: {
            type: 'boolean',
            default: false
          }
        }
      },
    AuthResponse: {
      type: "object",
      properties: {
        token: { type: "string", description: "JWT token for authentication" },
        user: {
          type: "object",
          properties: {
            _id: { type: "string" },
            name: { type: "string" },
            email: { type: "string" },
            googleId: { type: "string", nullable: true },
            isPasswordLinked: { type: "boolean" }
          }
        }
      }
    },
    LoginRequest: {
      type: "object",
      required: ["email", "password"],
      properties: {
        email: { type: "string", format: "email" },
        password: { type: "string", minLength: 6 }
      }
    },
    LinkPasswordRequest: {
      type: "object",
      required: ["password"],
      properties: {
        password: { type: "string", minLength: 6 }
      }
    },
      Prompt: {
        type: 'object',
        required: ['title', 'description', 'promptText', 'aiTool'],
        properties: {
          _id: {
            type: 'string',
            description: 'Auto-generated prompt ID'
          },
          title: {
            type: 'string',
            maxLength: 100,
            description: 'Prompt title'
          },
          description: {
            type: 'string',
            maxLength: 500,
            description: 'Prompt description'
          },
          promptText: {
            type: 'string',
            description: 'The actual prompt text'
          },
          resultText: {
            type: 'string',
            description: 'Expected or sample result'
          },
          aiTool: {
            type: 'string',
            enum: ['ChatGPT', 'Claude', 'Bard', 'Midjourney', 'DALL-E', 'Stable Diffusion', 'Other'],
            description: 'AI tool used for this prompt'
          },
          tags: {
            type: 'array',
            items: {
              type: 'string'
            },
            description: 'Search tags'
          },
          isPublic: {
            type: 'boolean',
            default: true
          },
          isDraft: {
            type: 'boolean',
            default: false
            },
          version: {
            type: 'number',
            default: 1
          },
          difficulty: {
            type: 'string',
            enum: ['Beginner', 'Intermediate', 'Advanced'],
            default: 'Beginner'
          },
          category: {
            type: 'string',
            enum: ['Art', 'Writing', 'Code', 'Marketing', 'Design', 'Education', 'Other'],
            default: 'Other'
          }
        }
      },
      SubscriptionPlan: {
        type: 'object',
        properties: {
          _id: {
            type: 'string',
            description: 'Auto-generated plan ID'
          },
          name: {
            type: 'string',
            enum: ['basic', 'standard', 'premium']
          },
          displayName: {
            type: 'string'
          },
          isFree: {
            type: 'boolean'
          },
          pricing: {
            type: 'object',
            properties: {
              USD: {
                type: 'object',
                properties: {
                  monthly: { type: 'number' },
                  yearly: { type: 'number' }
                }
              },
              NGN: {
                type: 'object',
                properties: {
                  monthly: { type: 'number' },
                  yearly: { type: 'number' }
                }
              }
            }
          }
        }
      },
      Error: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            default: false
          },
          message: {
            type: 'string',
            description: 'Error message'
          },
          errors: {
            type: 'array',
            items: {
              type: 'string'
            },
            description: 'Detailed error messages'
          }
        }
      },
      Success: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            default: true
          },
          message: {
            type: 'string'
          },
          data: {
            type: 'object',
            description: 'Response data'
          }
        }
      }
    }
  },
  tags: [
    {
      name: 'Authentication',
      description: 'User registration, login, and hybrid Google/Email authentication endpoints'
    },
    {
      name: 'Users',
      description: 'User management endpoints'
    },
    {
      name: 'Prompts',
      description: 'AI prompt management endpoints'
    },
    {
      name: 'Subscriptions',
      description: 'Subscription and payment endpoints'
    },
    {
      name: 'Images',
      description: 'Image upload and management endpoints'
    }
  ]
};

const options = {
  definition: swaggerDefinition,   // 👈 use "definition" (OpenAPI 3+)
  apis: ['./routes/*.js', './models/*.js', './controllers/*.js']
};

const swaggerSpec = swaggerJSDoc(options);

export default swaggerSpec;