from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from app.database import engine
from app.router import documents, auth, pages, questions,users, saved_questions

app = FastAPI(
    title="TEAM 01",
    description="Accessible AI Learning Space",
    version="1.0.0"
)
#CORS

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5175", "http://127.0.0.1:5175"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터 등록
app.include_router(auth.router)
app.include_router(documents.router)
app.include_router(pages.router)
app.include_router(questions.router)
app.include_router(questions.question_detail_router)
app.include_router(users.router)
app.include_router(saved_questions.router)

@app.get("/")
def home():
    return {
        "message": "BE Running!"
    }
    
@app.get("/db-test")
def db_test():
    with engine.connect() as connection:
        result = connection.execute(text("SELECT 1"))
        
    return {
        "database": "connected",
        "result": result.scalar()
    }