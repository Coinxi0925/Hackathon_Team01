from fastapi import FastAPI
from sqlalchemy import text
from app.database import engine

app = FastAPI(
    title="TEAM 01",
    description="Accessible AI Learning Space",
    version="1.0.0"
)

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