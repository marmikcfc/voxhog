from setuptools import setup, find_packages

setup(
    name="voxhog",
    version="0.1",
    packages=find_packages(),
    install_requires=[
        "fastapi>=0.95.0",
        "uvicorn>=0.21.1",
        "pydantic>=1.10.7",
        "python-dotenv>=1.0.0",
        "sqlalchemy>=1.4.0",
        # Other dependencies
    ],
) 