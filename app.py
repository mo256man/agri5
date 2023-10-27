from flask import Flask, render_template, request
from myEphem import Ephem
# from myContec import Contec
import json
import random
from time import sleep
import datetime
import configparser
import os

from gpiozero import MCP3004
import RPi.GPIO as GPIO
import dht11

light_pins = [26, 19, 13, 6, 5]     # 5個の光センサーの状態を取得するラズパイのGPIOピン
humi_pin = 20
led_pin = 16
pilot_pin = 21
pilot_status = False
humi_sensor = dht11.DHT11(pin=humi_pin)

GPIO.setwarnings(False)
GPIO.setmode(GPIO.BCM)
GPIO.cleanup()
GPIO.setup(pilot_pin, GPIO.OUT)
GPIO.setup(led_pin, GPIO.OUT)
for pin in light_pins:
    GPIO.setup(pin, GPIO.IN, pull_up_down=GPIO.PUD_DOWN)

# グローバル変数
light_sum = 0               # 光センサーオフの累計
sensing_count = 0           # 光センサー計測リセット回数
light_cnt = 0               # 光センサー計測回数　sensing_countの回数でリセット

battery = { "Ah": 100,
            "power": 12,    # LED消費電力（W）
            "cnt": 150,     # LED数
            "voltage": 24,  # 電圧（V）
            "BTcnt": 8,     # バッテリー個数
            "charge": 1500  # ソーラー＋風力での発電（Wh）
            }

# 設定ファイルのクラス
class Config():
    def __init__(self):
        self.filename = "config.ini"
        self.parser = configparser.ConfigParser()
        self.parser.optionxform = str       # 大文字小文字を区別する

    def read(self):
        # 設定ファイルが存在しない場合、デフォルト設定を新規作成する
        if not os.path.exists(self.filename):
            with open(self.filename, mode="w", encoding="utf-8") as f:
                msg = "[DEFAULT]\nplace = 名古屋\nlat = 35.1667\nlon = 136.9167\nelev = 0\n"
                msg += "morning_offset = 0\nevening_offset = 0\nmorning_minutes=90\nevening_minutes=90\nsensing_interval=10\nsensing_count=6\n"
                msg += "output1=1\noutput2=1\noutput3=1\noutput4=1\n"
                f.write()
        self.parser.read(self.filename, encoding="utf-8")
        return dict(self.parser["DEFAULT"])

    def write(self, dict):
        self.parser["DEFAULT"].update(dict)
        with open(self.filename, mode="w",  encoding="utf-8") as f:
            self.parser.write(f)


# MCP3004でアナログ値を取得する
def analog_read(ch):
    adc = MCP3004(ch).value
    return adc

# 日時を文字列として返す
def getTime():
    dt = datetime.datetime.now()
    return dt.strftime("%Y/%m/%d %H:%M:%S")

# ログを残す
def add_log(text, filename):
    with open(filename, mode="a") as f:
        f.write(text + "\n")

config = Config()                   # 設定のクラス
app = Flask(__name__)

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/getBattSetting", methods = ["POST"])
def getBattSetting():
    if request.method == "POST":
        return json.dumps(battery)             # 辞書をJSONにして返す

# ログへの書き込み
@app.route("/writeLog", methods = ["POST"])
def writeLog():
    if request.method == "POST":
        text = request.form["text"]
        filename = request.form["filename"]
        add_log(text, filename)
        return json.dumps({"result": "OK"})

# 暦
@app.route("/getEphem", methods = ["POST"])
def getEphem():
    try:
        ephem = Ephem(config.read())        # 設定をもとにephemを作成する
        dict = ephem.get_data()             # データを辞書として取得する
    except Exception as e:
        message = str(e)
        dict = {"error": message}  # エラーメッセージ
    add_log("暦算出", "動作ログ.txt")
    return json.dumps(dict)         # 辞書をJSONにして返す


# バッテリー電圧
@app.route("/getBatt", methods=["POST"])
def getBatt():
    if request.method == "POST":
        is_try = request.form["isTry"]
        dict = {}
        if is_try=="true":               # true/falseは文字列として送られてくる
            dict["ana3"] = random.randint(0, 100)
            dict["ana0"] = random.randint(0, 100)
            add_log(f"電圧（トライ）: {dict['ana3']}", "動作ログ.txt")
            print(f"{getTime()}　電圧（トライ）:{dict}")
        else:
            ana3 = analog_read(ch=3)
            ana0 = analog_read(ch=0)
            dict["ana3"] = int(ana3*100)
            dict["ana0"] = int(ana0*100)
            add_log(f"電圧（本番）: {dict['ana3']}", "動作ログ.txt")
            print(f"{getTime()}　電圧（本番）:{dict}")
        return json.dumps(dict)


# 温湿度計
@app.route("/getHumi", methods=["POST"])
def getHumi():
    if request.method == "POST":
        is_try = request.form["isTry"]
        dict = {}
        if is_try=="true":               # true/falseは文字列として送られてくる
            dict["temp"] = random.randint(10, 40)
            dict["humi"] = random.randint(0, 100)
            add_log(f"温度（トライ）: {dict['temp']}", "動作ログ.txt")
            add_log(f"湿度（トライ）: {dict['humi']}", "動作ログ.txt")
            print(f"{getTime()}　温湿度（トライ）:{dict}")
        else:
            result = humi_sensor.read()
            if result.is_valid():
                dict["temp"] = round(result.temperature, 1) # 温度 小数第一位まで
                dict["humi"] = round(result.humidity, 1)    # 湿度 小数第一位まで
            else:
                dict["temp"] = "N/A"
                dict["humi"] = "N/A"
            add_log(f"温度（本番）: {dict['temp']}", "動作ログ.txt")
            add_log(f"湿度（本番）: {dict['humi']}", "動作ログ.txt")
            print(f"{getTime()}　温湿度（本番）:{dict}")
        return json.dumps(dict)


# 光センサー
@app.route("/getLight", methods=["POST"])
def getLight():
    global light_cnt, light_sum, light_log, sensing_count
    light_cnt = (light_cnt+1) % sensing_count
    if light_cnt == 0:
        light_log = ""
        light_sum = 0

    if request.method == "POST":
        is_try = request.form["isTry"]
        lights = []
        if is_try=="true":               # true/falseは文字列として送られてくる
            lights = contec.input()
            print(lights)
            """
            for _ in light_pins:
                lights.append(random.choice([1, 0]))
            """
        else:
            for pin in light_pins:
                lights.append(GPIO.input(pin))
        
        light_sum += sum(lights)
        log = ""
        for light in lights:
            log += "○" if light==1 else "−"
        dict = {}
        dict["light_sum"] = light_sum
        dict["log"] = log
        dict["light_cnt"] = light_cnt
        return json.dumps(dict)


# 育成LEDへの出力
@app.route("/enpowerLED", methods=["POST"])
def enpowerLED():
    if request.method == "POST":
        is_On = int(request.form["isOn"])
        if is_On:
            print("育成LEDオン")
            contec.output(True)
        else:
            print("育成LEDオフ")
            contec.output(False)

        """
        is_On = int(request.form["isOn"])
        if is_On:
            print("育成LEDオン")
            GPIO.output(led_pin, True)
        else:
            print("育成LEDオフ")
            GPIO.output(led_pin, False)
        """
        return json.dumps({"response": "done"})


# 設定ファイル
@app.route("/getConfig", methods=["POST"])
def getConfig():
    global sensing_count
    if request.method == "POST":
        dict = config.read()
        sensing_count = int(dict["sensing_count"])      # 数値に直す
        arr = []
        for i in [1, 2, 3, 4]:
            arr.append(int(dict["output" + i]))
        print(arr)
        contec.define_output_relays(arr)
        return json.dumps(dict)


@app.route("/setConfig", methods=["POST"])
def setConfig():
    if request.method == "POST":
        dict = {"place": request.form["place"],
                "lat": request.form["lat"],
                "lon": request.form["lon"],
                "elev": request.form["elev"],
                "morning_offset": request.form["morning_offset"],
                "evening_offset": request.form["evening_offset"],
                "morning_minutes": request.form["morning_minutes"],
                "evening_minutes": request.form["evening_minutes"],
                "sensing_interval": request.form["sensing_interval"],
                "sensing_count": request.form["sensing_count"],
                "output1": request.form["output1"],
                "output2": request.form["output2"],
                "output3": request.form["output3"],
                "output4": request.form["output4"],
                }
        
        # 文字列のtrue/falseを1と0に変換する　ただしiniに書き込むため"1"と"0"にする
        for i in [1,2,3,4]:
            key = f"output{i}"
            dict[key] = "1" if request.form[key]=="true" else "0"
        
        print("設定変更", dict)
        config.write(dict)
        return json.dumps({"response": "done"})
        print("=" * 50)
    print("*" * 50)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
    # app.run(debug=True)
