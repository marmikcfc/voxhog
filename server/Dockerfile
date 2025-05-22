# Use an official Python runtime as a parent image
FROM python:3.9-slim

# Set the working directory in the container
WORKDIR /app

# Copy the requirements file into the container at /app
COPY ./server/requirements.txt /app/requirements.txt

# Install any needed packages specified in requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy the entire 'server' directory into the container at /app/server
COPY ./server /app/server

# Make port 8000 available to the world outside this container
EXPOSE 8000

# Define environment variable for database URL to ensure it's within the server's copied context
ENV DATABASE_URL="sqlite:///./server/voxhog.db"
ENV PYTHONPATH=/app

# Run main.py when the container launches
# It will look for main.py inside the 'server' subdirectory
CMD ["uvicorn", "server.main:app", "--host", "0.0.0.0", "--port", "8000"] 