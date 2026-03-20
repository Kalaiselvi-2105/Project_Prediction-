import sqlite3
import json
from datetime import datetime
from typing import List, Dict, Any
from dataclasses import dataclass
from pathlib import Path

@dataclass
class Project:
    id: int
    name: str
    description: str | None
    requirement_clarity: int
    team_experience: int
    resource_availability: int
    complexity: int
    communication_score: int
    delay_days: int
    scope_changes: int
    file_name: str | None
    file_content: str | None
    success_probability: float
    failure_probability: float
    risk_level: str
    recommendations: List[str]
    created_at: str

class ProjectDB:
    def __init__(self, db_path: str = "projects.db"):
        self.db_path = Path(db_path)
        self.init_db()

    def init_db(self):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT,
                requirement_clarity INTEGER NOT NULL,
                team_experience INTEGER NOT NULL,
                resource_availability INTEGER NOT NULL,
                complexity INTEGER NOT NULL,
                communication_score INTEGER NOT NULL,
                delay_days INTEGER DEFAULT 0 NOT NULL,
                scope_changes INTEGER DEFAULT 0 NOT NULL,
                file_name TEXT,
                file_content TEXT,
                success_probability REAL,
                failure_probability REAL,
                risk_level TEXT,
                recommendations TEXT,
                created_at TEXT NOT NULL
            )
        ''')
        conn.commit()
        conn.close()

    def create_project(self, project_data: Dict[str, Any]) -> Project:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO projects (
                name, description, requirement_clarity, team_experience, 
                resource_availability, complexity, communication_score,
                delay_days, scope_changes, file_name, file_content,
                success_probability, failure_probability, risk_level, recommendations, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            project_data['name'],
            project_data.get('description'),
            project_data['requirementClarity'],
            project_data['teamExperience'],
            project_data['resourceAvailability'],
            project_data['complexity'],
            project_data['communicationScore'],
            project_data.get('delayDays', 0),
            project_data.get('scopeChanges', 0),
            project_data.get('fileName'),
            project_data.get('fileContent'),
            project_data['successProbability'],
            project_data['failureProbability'],
            project_data['riskLevel'],
            json.dumps(project_data.get('recommendations', [])),
            datetime.now().isoformat()
        ))
        project_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return self.get_project(project_id)

    def get_projects(self) -> List[Project]:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM projects ORDER BY created_at DESC')
        rows = cursor.fetchall()
        conn.close()
        return [Project(
            id=row[0], name=row[1], description=row[2],
            requirement_clarity=row[3], team_experience=row[4],
            resource_availability=row[5], complexity=row[6],
            communication_score=row[7], delay_days=row[8], scope_changes=row[9],
            file_name=row[10], file_content=row[11],
            success_probability=row[12], failure_probability=row[13],
            risk_level=row[14], recommendations=json.loads(row[15]),
            created_at=row[16]
        ) for row in rows]

    def get_project(self, project_id: int) -> Project | None:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM projects WHERE id = ?', (project_id,))
        row = cursor.fetchone()
        conn.close()
        if row:
            return Project(
                id=row[0], name=row[1], description=row[2],
                requirement_clarity=row[3], team_experience=row[4],
                resource_availability=row[5], complexity=row[6],
                communication_score=row[7], delay_days=row[8], scope_changes=row[9],
                file_name=row[10], file_content=row[11],
                success_probability=row[12], failure_probability=row[13],
                risk_level=row[14], recommendations=json.loads(row[15]),
                created_at=row[16]
            )
        return None

db = ProjectDB()

