# Asistente de Diseño de Software

Aplicación full-stack para generar, editar, confirmar y difundir vistas de documentación y diagramas usando una arquitectura React + Express + Prisma + PostgreSQL.

## Desarrollo

```bash
npm install
npm run dev
```

## Docker

```bash
docker compose up --build
```

## Variables de entorno

- `DATABASE_URL`: cadena de conexión a PostgreSQL.
- `ANTHROPIC_API_KEY`: clave para la API de Anthropic.
- `PORT`: puerto del backend.
