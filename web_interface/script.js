// Configuración de MQTT
const mqttBroker = "broker.hivemq.com";
const mqttPort = 8000; // Puerto para conexiones WebSocket (común para brokers públicos)
const clientId = "webClient-" + parseInt(Math.random() * 100000); // Generar un ID de cliente único

// Tópicos de MQTT
const subscribeTopic = "casa/puerta/luz/estado"; // Donde el ESP32 publica su estado
const publishTopic = "casa/puerta/luz/control";  // Donde la interfaz publica comandos al ESP32

let client; // Variable global para el cliente MQTT

const statusDiv = document.getElementById('status');
const turnOnButton = document.getElementById('turnOnButton');
const turnOffButton = document.getElementById('turnOffButton');

// Función para conectar al broker MQTT
function connectMQTT() {
    statusDiv.textContent = 'Estado: Conectando al MQTT...';

    client = new Paho.MQTT.Client(mqttBroker, mqttPort, "/mqtt", clientId);

    // Asignar callbacks
    client.onConnectionLost = onConnectionLost;
    client.onMessageArrived = onMessageArrived;

    // Opciones de conexión
    const options = {
        timeout: 3,
        onSuccess: onConnect,
        onFailure: onFailure
    };

    try {
        client.connect(options);
    } catch (e) {
        console.error("Error al intentar conectar MQTT:", e);
        statusDiv.textContent = 'Estado: Error al conectar (ver consola)';
    }
}

// Callback cuando la conexión es exitosa
function onConnect() {
    console.log("Conectado al broker MQTT");
    statusDiv.textContent = 'Estado: Conectado. Esperando estado de la luz...';
    // Suscribirse al tópico donde el ESP32 publica su estado
    client.subscribe(subscribeTopic);
    console.log("Suscrito al tópico: " + subscribeTopic);
}

// Callback cuando la conexión falla
function onFailure(responseObject) {
    if (responseObject.errorCode !== 0) {
        console.error("Conexión MQTT fallida:", responseObject.errorMessage);
        statusDiv.textContent = 'Estado: Falló la conexión MQTT: ' + responseObject.errorMessage;
    }
    // Intentar reconectar después de un tiempo
    setTimeout(connectMQTT, 5000);
}

// Callback cuando se pierde la conexión
function onConnectionLost(responseObject) {
    if (responseObject.errorCode !== 0) {
        console.warn("Conexión MQTT perdida:", responseObject.errorMessage);
        statusDiv.textContent = 'Estado: Conexión perdida. Reconectando...';
    }
    // Intentar reconectar
    connectMQTT();
}

// Callback cuando llega un mensaje MQTT
function onMessageArrived(message) {
    console.log("Mensaje recibido: " + message.payloadString + " en tópico: " + message.destinationName);

    if (message.destinationName === subscribeTopic) {
        const lightState = message.payloadString;
        if (lightState === "ENCENDIDA") {
            statusDiv.textContent = 'Estado: Luz: ENCENDIDA';
            // Opcional: Deshabilitar botón "Encender" y habilitar "Apagar" para feedback visual
            turnOnButton.disabled = true;
            turnOffButton.disabled = false;
        } else if (lightState === "APAGADA") {
            statusDiv.textContent = 'Estado: Luz: APAGADA';
            // Opcional: Deshabilitar botón "Apagar" y habilitar "Encender"
            turnOnButton.disabled = false;
            turnOffButton.disabled = true;
        } else {
            statusDiv.textContent = 'Estado: Mensaje desconocido: ' + lightState;
        }
    }
}

// Función para publicar un mensaje
function publishMessage(command) {
    if (!client || !client.isConnected()) {
        console.warn("Cliente MQTT no conectado. No se puede publicar el mensaje.");
        statusDiv.textContent = 'Estado: No conectado al MQTT. Reconectando...';
        connectMQTT(); // Intentar reconectar
        return;
    }

    const message = new Paho.MQTT.Message(command);
    message.destinationName = publishTopic;
    message.retained = true; // Para que el último estado sea persistente
    client.send(message);
    console.log("Mensaje publicado: " + command + " en tópico: " + publishTopic);
    statusDiv.textContent = 'Estado: Enviando comando: ' + command;
}

// Event Listeners para los botones
document.addEventListener('DOMContentLoaded', () => {
    turnOnButton.addEventListener('click', () => {
        publishMessage("ON");
    });

    turnOffButton.addEventListener('click', () => {
        publishMessage("OFF");
    });

    // Iniciar la conexión MQTT al cargar la página
    connectMQTT();
});

