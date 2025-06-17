#include <WiFi.h>
#include <PubSubClient.h>

// Constantes de configuración de la red WiFi
const char* ssid = "ETEC-UBA"; // Nombre de la red WiFi
const char* password = "ETEC-alumnos@UBA"; // Contraseña de la red WiFi

// Constantes para el Broker MQTT (¡REEMPLAZA CON LA DIRECCIÓN DE TU BROKER SI USAS OTRO!)
const char* mqtt_server = "broker.hivemq.com"; // Dirección del broker MQTT (ejemplo de broker público)
const int mqtt_port = 1883; // Puerto estándar para MQTT
const char* mqtt_client_id = "ESP32Client-LuzPuerta"; // ID único para este cliente MQTT
const char* mqtt_topic_subscribe = "casa/puerta/luz/control"; // Tópico al que este ESP32 se suscribe para recibir comandos
const char* mqtt_topic_publish = "casa/puerta/luz/estado"; // Tópico al que este ESP32 publica el estado de la luz

WiFiClient espClient; // Objeto cliente WiFi para la conexión de red
PubSubClient client(espClient); // Objeto cliente PubSubClient para la comunicación MQTT

// Pin al que está conectada la luz (ejemplo: GPIO2)
const int luzPin = 2;

/**
 * @brief Controla el estado de la luz (encender/apagar).
 * @param state true para encender, false para apagar.
 */
void setLightState(bool state) {
    // Escribe el estado en el pin de la luz. HIGH para encender, LOW para apagar.
    // Dependerá de cómo esté conectado tu circuito (relé normalmente abierto/cerrado).
    digitalWrite(luzPin, state ? HIGH : LOW); 
    
    Serial.print("Estado de la luz: ");
    Serial.println(state ? "ENCENDIDA" : "APAGADA");
    
    // Publica el estado actual de la luz en el tópico de publicación.
    // 'true' indica que el mensaje es retenido (retained), así los nuevos suscriptores obtienen el último estado.
    client.publish(mqtt_topic_publish, state ? "ENCENDIDA" : "APAGADA", true); 
}

/**
 * @brief Función callback que se ejecuta cuando se recibe un mensaje MQTT.
 * @param topic Tópico del mensaje recibido.
 * @param payload Contenido del mensaje (datos binarios).
 * @param length Longitud del payload.
 */
void callback(char* topic, byte* payload, unsigned int length) {
    Serial.print("Mensaje recibido en el topic: ");
    Serial.println(topic);
    Serial.print("Contenido: ");

    // Crear un buffer para almacenar el payload como una cadena de caracteres (string).
    char messagePayload[length + 1]; // +1 para el terminador nulo '\0'
    for (int i = 0; i < length; i++) {
        messagePayload[i] = (char)payload[i];
    }
    messagePayload[length] = '\0'; // Asegurar que sea una cadena de caracteres terminada en null

    Serial.println(messagePayload);

    // Procesar el mensaje para encender o apagar la luz, solo si viene del tópico de control.
    if (strcmp(topic, mqtt_topic_subscribe) == 0) {
        if (strcmp(messagePayload, "ON") == 0) { // Si el mensaje es "ON"
            setLightState(true); // Encender la luz
        } else if (strcmp(messagePayload, "OFF") == 0) { // Si el mensaje es "OFF"
            setLightState(false); // Apagar la luz
        } else {
            Serial.println("Mensaje no reconocido. Use 'ON' o 'OFF'."); // Mensaje inválido
        }
    }
}

/**
 * @brief Función para conectar al broker MQTT. Intenta reconectar si la conexión se pierde.
 */
void connectMQTT() {
    // Bucle para intentar conectar hasta que la conexión sea exitosa.
    while (!client.connected()) {
        Serial.print("Conectando al broker MQTT...");
        // Intentar conectar al broker con el ID de cliente.
        if (client.connect(mqtt_client_id)) {
            Serial.println(" conectado");
            // Publicar un mensaje de conexión exitosa en el tópico de estado.
            client.publish(mqtt_topic_publish, "Conectado", true); 
            // Suscribirse al tópico de control para recibir comandos.
            client.subscribe(mqtt_topic_subscribe); 
            Serial.print("Suscrito al tópico: ");
            Serial.println(mqtt_topic_subscribe);
        } else {
            Serial.print("falló, rc="); // 'rc' es el código de retorno
            Serial.print(client.state()); // Mostrar el estado del cliente MQTT
            Serial.println(" retentando en 5 segundos");
            delay(5000); // Esperar 5 segundos antes de reintentar
        }
    }
}

/**
 * @brief Función de configuración inicial del ESP32. Se ejecuta una vez al inicio.
 */
void setup() {
    Serial.begin(115200); // Inicializar la comunicación serial a 115200 baudios
    Serial.println();
    Serial.println("Iniciando...");

    pinMode(luzPin, OUTPUT); // Configurar el pin de la luz como salida
    digitalWrite(luzPin, LOW); // Inicialmente, la luz está apagada

    // Conectar a la red WiFi
    WiFi.begin(ssid, password); // Iniciar la conexión WiFi
    Serial.print("Conectando a la red WiFi: ");
    Serial.println(ssid);

    // Esperar hasta que el WiFi esté conectado.
    while (WiFi.status() != WL_CONNECTED) {
        delay(500); // Esperar medio segundo
        Serial.print("."); // Imprimir puntos mientras se conecta
    }

    Serial.println(""); // Nueva línea
    Serial.println("WiFi conectado");
    Serial.print("Dirección IP: ");
    Serial.println(WiFi.localIP()); // Imprimir la dirección IP asignada al ESP32

    // Configurar el cliente MQTT y el callback para mensajes entrantes.
    client.setServer(mqtt_server, mqtt_port); // Establecer la dirección y puerto del broker MQTT
    client.setCallback(callback); // Asignar la función callback para mensajes recibidos

    // Conectar al broker MQTT.
    connectMQTT();
}

/**
 * @brief Bucle principal del programa. Se ejecuta repetidamente después de setup().
 */
void loop() {
    // Si el cliente MQTT no está conectado, intentar reconectar.
    if (!client.connected()) {
        connectMQTT(); // Reconectar si se pierde la conexión
    }
    client.loop(); // Mantener la conexión MQTT y procesar los mensajes pendientes
    // Esta función debe llamarse con frecuencia para permitir que el cliente MQTT
    // procese mensajes entrantes y mantenga la conexión.
}
