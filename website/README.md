## Website Build Instructions

### System Dependencies

* Node (+ npm)
* Bower
* Gulp

#### Installing Bower and Gulp

Well... use a package manager to install a package manager. Obviously :-P

```shell
npm install -g bower
npm install -g gulp
```

### Project Dependencies

```shell
npm install
bower install
```

### Develop

```shell
gulp server
```

and browse to http://localhost:4000/

### Build

```shell
gulp

git subtree push --prefix website/dist origin gh-pages
```
