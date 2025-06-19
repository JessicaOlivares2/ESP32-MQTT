// Configuración de MQTT
const mqttBroker = "broker.hivemq.com";
const mqttPort = 8000; // Puerto para conexiones WebSocket (común para brokers públicos)
const clientId = "webClient-" + parseInt(Math.random() * 100000); // Generar un ID de cliente único

// Tópicos de MQTT
const subscribeTopic = "casa/puerta/luz/estado"; // Donde el ESP32 publica su estado
const publishTopic = "casa/puerta/luz/control";  // Donde la interfaz publica comandos al ESP32

let client; // Variable global para el cliente MQTT

// Referencias a los elementos del DOM (ya existentes en tu código)
const statusDiv = document.getElementById('status');
const turnOnButton = document.getElementById('turnOnButton');
const turnOffButton = document.getElementById('turnOffButton');

// **NUEVAS** referencias a los elementos del DOM para el diseño del interruptor
const switchHandle = document.getElementById('switchHandle');
const statusText = document.getElementById('statusText');
const statusIndicator = document.getElementById('statusIndicator');


// Función para conectar al broker MQTT
function connectMQTT() {
    statusDiv.textContent = 'Estado: Conectando al MQTT...';

    // Asegurarse de que Paho.MQTT.Client esté disponible antes de usarlo
    if (typeof Paho === 'undefined' || typeof Paho.MQTT === 'undefined' || typeof Paho.MQTT.Client === 'undefined') {
        console.error("Paho MQTT library not loaded. Please ensure paho-mqtt.min.js is included before script.js.");
        statusDiv.textContent = 'Error: Librería MQTT no cargada.';
        return;
    }

    client = new Paho.MQTT.Client(mqttBroker, mqttPort, "/mqtt", clientId);

    // Asignar callbacks
    client.onConnectionLost = onConnectionLost;
    client.onMessageArrived = onMessageArrived;

    // Opciones de conexión
    const options = {
        timeout: 3,
        onSuccess: onConnect,
        onFailure: onFailure,
        cleanSession: true // Es buena práctica para clientes web
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

    // Opcional: Publicar un mensaje inicial para que el ESP32 envíe su estado actual
    // Si tu ESP32 responde a un comando para enviar su estado, podrías hacerlo aquí:
    // publishMessage("GET_STATUS");
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
        // Normaliza el estado a mayúsculas para manejar "encendida", "ON", etc.
        const lightState = message.payloadString.toUpperCase(); 
        
        if (lightState === "ON" || lightState === "ENCENDIDA") {
            // Actualiza el texto de estado general
            statusDiv.textContent = 'Estado: Luz: ENCENDIDA';
            // Actualiza los elementos del nuevo diseño visual
            statusText.textContent = 'Encendido';
            switchHandle.classList.add('on');
            switchHandle.classList.remove('off');
            statusIndicator.classList.add('on');
            statusIndicator.classList.remove('off');
            // Habilita/deshabilita botones para feedback
            turnOnButton.disabled = true;
            turnOffButton.disabled = false;
        } else if (lightState === "OFF" || lightState === "APAGADA") {
            // Actualiza el texto de estado general
            statusDiv.textContent = 'Estado: Luz: APAGADA';
            // Actualiza los elementos del nuevo diseño visual
            statusText.textContent = 'Apagado';
            switchHandle.classList.add('off');
            switchHandle.classList.remove('on');
            statusIndicator.classList.add('off');
            statusIndicator.classList.remove('on');
            // Habilita/deshabilita botones para feedback
            turnOnButton.disabled = false;
            turnOffButton.disabled = true;
        } else {
            // Manejo de estados desconocidos
            statusDiv.textContent = 'Estado: Mensaje de luz desconocido: ' + lightState;
            statusText.textContent = 'Desconocido';
            switchHandle.classList.remove('on', 'off'); // Quitar clases si es un estado no reconocido
            statusIndicator.classList.remove('on', 'off'); // Quitar clases si es un estado no reconocido
            turnOnButton.disabled = false; 
            turnOffButton.disabled = false;
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
    message.retained = false; // Comandos generalmente no son retenidos
    client.send(message);
    console.log("Mensaje publicado: " + command + " en tópico: " + publishTopic);
    statusDiv.textContent = 'Estado: Enviando comando: ' + command;
}

// Event Listeners para los botones
document.addEventListener('DOMContentLoaded', () => {
    // Aquí es donde se ejecuta tu código una vez que el DOM está completamente cargado.
    // Esto incluye asegurar que las librerías externas (como Paho) se hayan inicializado.

    turnOnButton.addEventListener('click', () => {
        publishMessage("ON"); // Envía "ON" o "ENCENDER" según lo que espere tu ESP32
    });

    turnOffButton.addEventListener('click', () => {
        publishMessage("OFF"); // Envía "OFF" o "APAGAR" según lo que espere tu ESP32
    });

    // ¡IMPORTANTE! Iniciar la conexión MQTT aquí, DENTRO de DOMContentLoaded
    // Esto asegura que Paho ya esté disponible cuando connectMQTT sea llamada.
    connectMQTT(); 
});