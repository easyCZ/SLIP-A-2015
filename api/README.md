## [API](http://api-ubervest.rhcloud.com/)

### Setup
1. Create virtual environment for python `virtualenv venv`
2. Source the environment `source ./venv/bin/activate`
3. Install dependencies `pip3 install -r requirements.txt`
4. Run migrations `<api_root>/manage migrate`

### Running
1. Run `<api_root>/manage runserver`
2. Navigate to [http://localhost:8000](http://localhost:8080)

### Database Management & Migrations
Taken care of by django. To update schema, run the following:
```
./manage makemigrations
./manage migrate
```
Make sure you never merge migration merge issues.


### Django shell
```
source /var/lib/openshift/56195dcb2d527167370000bc/python/virtenv/venv/bin/activate
python app-root/repo/wsgi/src/manage.py shell
```


### Deployment
Deployment will be taken care of by Jenkins running on the openshift platform. Changes are polled every 3 minutes or so. It may take a moment to propagate. Hot deploy is currently not configured and therefore the application will be down between re-deployments.
