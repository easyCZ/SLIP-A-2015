# API Server

## Setup
Setup [virtualenv](https://packaging.python.org/en/latest/installing/#virtual-environments) `virtualenv-3.4 venv`

Activate virtual environment `source ./venv/bin/activate`

Install dependencies `pip install -r requirements.txt`

Alternatively, use `./.setup` but virtual enviornment may need to be activated manually.


## Adding Python dependencies
Make sure you have actiavated the *venv*

Use pip: `pip install <dependency>` and update the requirements file with `pip freeze > requirements.txt`