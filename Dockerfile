FROM node:22.22-alpine3.23

# Set PNPM environment variables
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

# Enable corepack and activate pnpm
RUN corepack enable 
RUN corepack prepare pnpm@9.0.0 --activate 

# app code commands
WORKDIR /app
RUN addgroup app && adduser -S -G app app
RUN chown -R app:app /app
USER app
COPY --chown=app:app package.json pnpm-lock.yaml ./
RUN pnpm install 
COPY . .
EXPOSE 3000 
ENTRYPOINT [ "pnpm", "dev" ]


