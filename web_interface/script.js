// Configuración de MQTT
const mqttBroker = "broker.hivemq.com";
const mqttPort = 8000; // Puerto para conexiones WebSocket (común para brokers públicos)
const clientId = "webClient-" + parseInt(Math.random() * 100000); // Generar un ID de cliente único

// Tópicos de MQTT
const subscribeTopic = "casa/puerta/luz/estado"; // Donde el ESP32 publica su estado
const publishTopic = "casa/puerta/luz/control";  // Donde la interfaz publica comandos al ESP32

let client; // Variable global para el cliente MQTT

// Referencias a elementos HTML de la UI
let statusDiv;
let turnOnButton;
let turnOffButton;
let switchHandle;
let lightSwitchBase;
let statusIndicator;
let statusText;

// Función para conectar al broker MQTT
function connectMQTT() {
    statusDiv.textContent = 'Estado: Conectando al MQTT...';
    
    // CORRECCIÓN: Usar Paho.Client (no Paho.MQTT.Client)
    client = new Paho.Client(mqttBroker, mqttPort, "/mqtt", clientId);

    // Asignar callbacks
    client.onConnectionLost = onConnectionLost;
    client.onMessageArrived = onMessageArrived;

    // Opciones de conexión
    const options = {
        timeout: 3, // Tiempo en segundos para intentar conectar
        onSuccess: onConnect,
        onFailure: onFailure
    };

    try {
        client.connect(options);
    } catch (e) {
        console.error("Error al intentar conectar MQTT:", e);
        statusDiv.textContent = 'Estado: Falló la conexión MQTT: ' + e.message;
        setTimeout(connectMQTT, 5000); 
    }
}

// Callback cuando la conexión es exitosa
function onConnect() {
    console.log("Conectado al broker MQTT");
    statusDiv.textContent = 'Estado: Conectado. Esperando estado de la luz...';
    client.subscribe(subscribeTopic);
    console.log("Suscrito al tópico: " + subscribeTopic);
}

// Callback cuando la conexión falla
function onFailure(responseObject) {
    if (responseObject.errorCode !== 0) {
        console.error("Conexión MQTT fallida:", responseObject.errorMessage);
        statusDiv.textContent = 'Estado: Falló la conexión MQTT: ' + responseObject.errorMessage;
    }
    setTimeout(connectMQTT, 5000);
}

// Callback cuando se pierde la conexión
function onConnectionLost(responseObject) {
    if (responseObject.errorCode !== 0) {
        console.warn("Conexión MQTT perdida:", responseObject.errorMessage);
        statusDiv.textContent = 'Estado: Conexión perdida. Reconectando...';
    }
    connectMQTT();
}

function updateUIForLightState(state) {
    if (state === "ENCENDIDA") {
        statusText.textContent = 'Encendida';
        statusIndicator.classList.remove('off');
        statusIndicator.classList.add('on');
        lightSwitchBase.classList.add('on'); 
        
        turnOnButton.disabled = true;
        turnOffButton.disabled = false;
    } else if (state === "APAGADA") {
        statusText.textContent = 'Apagada';
        statusIndicator.classList.remove('on');
        statusIndicator.classList.add('off');
        lightSwitchBase.classList.remove('on'); 
        
        turnOnButton.disabled = false;
        turnOffButton.disabled = true;
    } else {
        statusText.textContent = 'Desconocido';
        statusIndicator.classList.remove('on', 'off'); 
        lightSwitchBase.classList.remove('on'); 
        
        turnOnButton.disabled = false; 
        turnOffButton.disabled = false;
    }
}

// Callback cuando llega un mensaje MQTT
function onMessageArrived(message) {
    console.log("Mensaje recibido: " + message.payloadString + " en tópico: " + message.destinationName);

    if (message.destinationName === subscribeTopic) {
        const lightState = message.payloadString;
        updateUIForLightState(lightState); 
    }
}

// Función para publicar un mensaje
function publishMessage(command) {
    if (!client || !client.isConnected()) {
        console.warn("Cliente MQTT no conectado. No se puede publicar el mensaje. Reconectando...");
        statusDiv.textContent = 'Estado: No conectado al MQTT. Reconectando...';
        connectMQTT(); 
        return;
    }

    // CORRECCIÓN: Usar Paho.Message (no Paho.MQTT.Message)
    const message = new Paho.Message(command);
    message.destinationName = publishTopic;
    message.retained = true; 
    client.send(message);
    console.log("Mensaje publicado: " + command + " en tópico: " + publishTopic);
    statusDiv.textContent = 'Estado: Enviando comando: ' + command;
}

// Inicialización cuando TODO el documento ha cargado (incluyendo scripts externos)
window.onload = () => {
    // Inicializar referencias a los elementos HTML
    statusDiv = document.getElementById('status');
    turnOnButton = document.getElementById('turnOnButton');
    turnOffButton = document.getElementById('turnOffButton');
    switchHandle = document.getElementById('switchHandle');
    lightSwitchBase = document.querySelector('.light-switch');
    statusIndicator = document.getElementById('statusIndicator');
    statusText = document.getElementById('statusText');

    // Adjuntar Event Listeners para los botones y el interruptor visual
    turnOnButton.addEventListener('click', () => {
        publishMessage("ON");
    });

    turnOffButton.addEventListener('click', () => {
        publishMessage("OFF");
    });

    // Añadir interactividad al interruptor visual
    lightSwitchBase.addEventListener('click', () => {
        if (lightSwitchBase.classList.contains('on')) {
            publishMessage("OFF");
        } else {
            publishMessage("ON");
        }
    });

    // Iniciar la conexión MQTT al cargar la página
    connectMQTT();
};
