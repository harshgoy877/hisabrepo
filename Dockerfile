# ── Stage 1: Build React frontend ─────────────────────────────
FROM node:18-alpine AS frontend
WORKDIR /frontend
COPY frontend/package.json frontend/yarn.lock* ./
RUN yarn install
COPY frontend/ .
ENV REACT_APP_BACKEND_URL=""
RUN yarn build

# ── Stage 2: Run FastAPI backend ───────────────────────────────
FROM python:3.11-slim
WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .

# Copy React build into backend/static so FastAPI can serve it
COPY --from=frontend /frontend/build ./static

# Create uploads folder for images
RUN mkdir -p uploads

EXPOSE 8080
CMD uvicorn server:app --host 0.0.0.0 --port ${PORT:-8080}
