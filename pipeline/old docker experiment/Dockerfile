FROM python:3.11.15-trixie

# Copy the project into the image
COPY . /app
# Sync the project into a new environment, asserting the lockfile is up to date
WORKDIR /app
RUN apt update && \
apt install -y tk x11-apps && \
rm -rf /var/lib/apt/lists/* && \
pip install polars pillow

CMD ["python3","pipeline.py"]

