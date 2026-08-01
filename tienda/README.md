"# bodega12_frontend" 


ESTRUCTURA BASICA DE TU APP.JSON

{
  "expo": {
    "name": "Bodega 12",
    "slug": "bodega12-app",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "newArchEnabled": true,
    "splash": {
      "image": "./assets/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "scheme": "bodega12",
    "ios": {
      "supportsTablet": true
    },
    "android": {
      "package": "cl.bodega12.app",
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      },
      "edgeToEdgeEnabled": true
    },
    "web": {
      "favicon": "./assets/logo-cibox.png"
    },
    "plugins": [
      "expo-font"
    ]
  }
}

Instalar EAS CLI

npm install -g eas-cli

Iniciar sesión en Expo

eas login

//https://expo.dev/login revisa tu cuenta expo

crear la configuración de EAS en tu proyecto

eas build:configure

select all platform
> All

en el archivo que se crea eas.json debe tener esta estructura

{
  "cli": {
    "version": ">= 18.8.0",
    "appVersionSource": "remote"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {}
  }
}

revisar donde apuntan las URL de tu backend

//crear la apk
eas build -p android --profile preview