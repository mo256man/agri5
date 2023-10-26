// グローバル変数
let isAuto =true;           // 自動か各個か
let isHumiTry = false;      // 温湿度計がトライか本番か
let isBattTry = false;      // バッテリ電圧計がトライか本番か
let isLightTry = false;     // 光センサーがトライか本番か
let isLEDTry = true;        // 育成LEDがトライか本番か
let isLED = false;          // 育成LEDを光らせるか
let isForce = false;        // LEDを強制的にオンオフさせるか光センサーで制御するか
let mode = true             // モード（自動／強制オン／強制オフ／手動操作中）
let lastmode = false        // 1秒前のモード　モードが変わったらログを残す
let tab = "main";
let lights = "○−○−○";
const pins = ["26", "19", "13", "6", "5"];
let temp, humi              // 温度と湿度
let vp, volt, capa, BT, Ah, pow, cnt, voltage, BTcnt, charge, maxwh, maxv
let redp, yellowp, totalwh
let sunrise_time, sunset_time               // 日の出日の入り時刻
let morning_start_time, evening_start_time  // 強制点灯開始時刻
let morning_end_time, evening_end_time      // 強制点灯終了時刻
let wh
let humiID      // setInterval()でgetHumiする際のID
let voltID      // setInterval()でgetVoltする際のID
let now, today, time
let logMsg="";
let logTxt="";
let bp;
    
$(async function() {
    // 読み込み完了後に一度だけ実行する関数
    await do1st();

   
    setInterval(showTime, 1000);

    // 自動・各個　切り替え
    $("#swAuto").on('click', function(){
        isAuto = !isAuto;
        showState();
        if (isAuto) {
            showLights(lights);
            enpowerLED(isLED);
            showLedLamp(isLED);
            $("#mode").text(mode);
        } else {
            showLights([0,0,0,0,0]);
            enpowerLED(false);
            showLedLamp(false);
            $("#mode").text("手動操作中");
        }
    })

    // ランプ全点灯ボタンを押す
    $("#btnAllLight").mousedown(function(){
        if (! isAuto) {
            $("#imgLight").attr("src", "static/images/btn_push.png");
            showLights([1,1,1,1,1]);
            showLedLamp(true);
        }
    })

    // ランプ全点灯ボタンを離す
    $("#btnAllLight").mouseup(function(){
        if (! isAuto) {
            $("#imgLight").attr("src", "static/images/btn_normal.png");
            showLights([0,0,0,0,0]);
            showLedLamp(false);
        }
    })

    // 育成LED強制点灯ボタンを押す
    $("#btnLedOn").mousedown(function(){
        if (! isAuto) {
            $("#imgLedOn").attr("src", "static/images/btn_push.png");
            enpowerLED(true);
        }
    })

    // 育成LED強制点灯ボタンを離す
    $("#btnLedOn").mouseup(function(){
        if (! isAuto) {
            $("#imgLedOn").attr("src", "static/images/btn_normal.png");
            enpowerLED(false);
            showLedLamp(false);
        }
    })

    // 設定画面を出す
    $("#btnConfig").on("click", function(){
        getConfig();
        $(".config_bg").css("visibility", "visible");
        $(".config_window").css("visibility", "visible");
    });


    // 設定変更ボタンを押す
    $("#setConfig").on("click", function(){
        setConfig();
    });

    // 設定画面を閉じる
    $(".config_bg").on("click", function(){
        $(".config_bg").css("visibility", "hidden");
        $(".config_window").css("visibility", "hidden");
    });


    // トライボタン切り替え
    $(".btnTry").on('click', function(){
        const btnid = $(this).attr("id");
        var bool = false;
        switch (btnid) {
            case "HumiTry":
                isHumiTry = ! isHumiTry;
                bool = isHumiTry;
                break;
            case "BattTry":
                isBattTry = ! isBattTry;
                bool = isBattTry;
                break;
            case "LightTry":
                isLightTry = ! isLightTry;
                bool = isLightTry;
                break;
            case "LEDTry":
                isLEDTry = ! isLEDTry;
                bool = isLEDTry;
                break;
        }
        showTryBtn("#"+btnid, bool);
    })

});


//////////////////////////////////////////////////////////////////////
// 最初に1回だけ実行する関数
//////////////////////////////////////////////////////////////////////
async function do1st() {
    // インプットボックスにjQuery keypadを設定する
    const kbOpt = {showAnim: "slideDown", showOptions: null, duration: "fast", showOn:"button"};    // 数値キーパッドのオプション
    const ids = ["#lat", "#lon", "#elev", "#morning_offset", "#evening_offset", "#morning_minutes", "#evening_minutes"];    // キーパッドを設定するid
    $.each(ids, function(i, id){
        $(id).keypad(kbOpt);
    });
    
    getNow();
    clearMsg();
    addMsg(time+"　開始")
    await getEphem();
    await getBattSetting();
    await getBatt(true);
    await getHumi(true);
    await getLight(true);
    showLights(lights);
    getTimeMode();
    clearLightMsg();
}

//////////////////////////////////////////////////////////////////////
// 表示しているタブを取得する
function getTab() {
    const elm = $('input:radio[name="tab_item"]:checked')
    return elm.val();
}

// 今日の日付を取得する　グローバル変数に格納するだけ
function getNow() {
    now = dayjs();
    today = now.format("YYYY/MM/DD");
    time = now.format("HH:mm:ss");
};

// 時計　兼　アラーム
async function showTime() {
    getNow();
    $("#time").html(today + " " + time);

    const h = now.hour();
    const m = now.minute();
    const s = now.second();

    if (isAuto) {
        // 60分ごとに温湿度を更新する
        if (m==10 && s==20) {
            getHumi(isHumiTry);
        }

        // 10分ごとバッテリ残容量を更新する
        if (s==10) {
            addMsg(time + "　バッテリ残容量更新");
            bp = getBatt(isBattTry);
        }

        // 1分ごとに光センサーを更新する　ただし自動制御中のみ
        if (true) {
        //if (! isForce) {
            if (s==30) {
                getLight(isLightTry);
            }
        }
        
        //0時0分になったらあらためて暦を取得する
        if (time=="00:00:00") {
            addMsg(time+"　日付が変わった")
            getEphem();
        }

        // 日の出などの時間による制御
        getTimeMode();
    }

}


//////////////////////////////////////////////////////////////////////
// トライの状態を表示する関数
function showTryBtn(btnid, bool) {
    const elm = $(btnid);
    if (bool) {
        elm.css("background-color", "pink");
        elm.text("トライ");
    } else {
        elm.css("background-color", "yellow");
        elm.text("本番");
    }
}

//////////////////////////////////////////////////////////////////////
//    ログ
//////////////////////////////////////////////////////////////////////
// メッセージを表示する
function addMsg(txt) {
    logMsg = $("#logbox").html();
    logMsg += txt + "<br>";
    $("#logbox").html(logMsg);
}

// メッセージを全削除する
function clearMsg() {
    $("#logbox").html("");
}

// センサーログを表示する
function addLightLog(txt) {
    logMsg = $("#lightlog").html();
    logMsg += txt + "<br>";
    $("#lightlog").html(logMsg);
}

// 光センサーログを削除する
function clearLightMsg() {
    $("#lightlog").html("光センサー　6回測定し、次の点灯消灯を判断します<br>");
}


//////////////////////////////////////////////////////////////////////
//    温湿度
//////////////////////////////////////////////////////////////////////
async function getHumi(isTry) {
    await $.ajax("/getHumi", {
        type: "post",
        data: {"isTry": isTry},                 // テストか本番かのbool値をisTryとして送る
    }).done(function(data) {
        const dict = JSON.parse(data);
        if (dict["temp"] != "N/A") {            // センサー値取得できていたら
            temp = dict["temp"];
            humi = dict["humi"];
            $("#temp").text(temp + "℃");
            $("#humi").text(humi + "％");
            addMsg(time + "　温湿度更新");
        } else {                                // センサー値取得できなかったら
            console.log("温湿度　センサー失敗");
        }
    }).fail(function() {                        // ajaxのリターン失敗したら更新しない
        console.log("温湿度　通信失敗");
    });
}



//////////////////////////////////////////////////////////////////////
//    日光
//////////////////////////////////////////////////////////////////////
async function getLight(isTry) {
    await $.ajax("/getLight", {
        type: "post",
        data: {"isTry": isTry},                 // テストか本番かのbool値をisTryとして送る
    }).done(function(data) {
        const dict = JSON.parse(data);
        console.log(dict);
        try {                                   // センサー値取得できていたら
            if (dict["light_cnt"]==0) {         // 0回目で
                clearLightMsg();                // メッセージをクリアする
            }
            addLightLog(time + "　#" + (dict["light_cnt"]+1) + "　" + dict["log"]);
            showLights(dict["log"]);
            if (dict["light_cnt"]==5) {         // 6回センサー値を測定したら
                if (dict["light_sum"] > 8) {    // 点灯消灯判断する
                    addLightLog("　十分明るいので点灯しない")
                    isLED = false;
                } else {
                    addLightLog("　明るさが足りないので点灯する")
                    isLED = false;
                }
                enpowerLED(isLED);
            }
        } catch(e) {                            // センサー値取得できなかったら
            console.log("光センサー　センサー失敗");
        }
    }).fail(function() {                        // ajaxのリターン失敗したら更新しない
        console.log("光センサー　通信失敗");
    });
};

// 光センサーの状態を表示する関数
function showLights(txt) {
    const arr = txt.split("");
    for (let i=0; i<arr.length; i++) {
        let color="";
        if (arr[i]=="○") {
            color = "red";
        } else {
            color = "gray";
        }
        $("#lamp" + i).css("color",color);
    };
};


// 育成LEDを光らせる
async function enpowerLED(flag) {
    let img = "static/images/";
    let color = "";
    let isOn = 0;

    if (flag) {
        img += "led_on.png";
        color = "red";
        isOn = 1;
    } else {
        img += "led_off.png";
        color = "gray";
        isOn = 0;
    }

    $("#imgLed").attr("src", img);
    $("#lamp_led").css("color", color);
    
   await $.ajax("/enpowerLED", {
       type: "post",
       data: {"isOn": isOn},
    }).done(function() {
        // 特に何もしない
    }).fail(function() {  
        // 特に何もしない
    });
}


// フラグの状態を表示する関数
function showState() {
    var strAuto = "";
    var imgSw = "";
    if (isAuto) {
        strAuto = "自動";
        imgSw = "sw_l.png";
    } else {
        strAuto = "各個";
        imgSw = "sw_r.png";
    };
    $("#stateAuto").text(strAuto);
    $("#imgAuto").attr("src", "static/images/" + imgSw );
}


// 育成LEDの状態を表示する関数
function showLedLamp(flag) {
    var color="";
    if (flag) {
        color = "red";
    } else {
        color = "gray";
    }
    $("#lamp_led").css("color",color);
}


//////////////////////////////////////////////////////////////////////
//    暦
//////////////////////////////////////////////////////////////////////
async function getEphem() {
    $("#date").text(dayjs().format("M月D日"))
    await getConfig();                                      // あらためて設定を読み込む
    console.log("暦取得するぞ");
    await $.ajax("/getEphem", {
        type: "POST",
    }).done(function(data) {
        const dict = JSON.parse(data);
        sunrise_time = dict["today_sunrise"];               // HH:MM
        sunset_time = dict["today_sunset"];                 // HH:MM
        $("#sunrise").text(sunrise_time);
        $("#sunset").text(sunset_time);
        $("#moon_phase").text(dict["moon_phase"]);
        $("#moon_image").attr("src", dict["moon_image"]);

        // 日の出日の入り時刻から育成LED点灯消灯の時刻を計算する
        // まずはdayjsとして計算する
        const morning_offset = Number($("#morning_offset").val());
        const evening_offset = Number($("#evening_offset").val());
        const morning_minutes = Number($("#morning_minutes").val());
        const evening_minutes = Number($("#evening_minutes").val());
        morning_start_time = dayjs(today+" "+sunrise_time).add(morning_offset, "m");
        morning_end_time = morning_start_time.add(morning_minutes, "m");
        evening_end_time = dayjs(today+" "+sunset_time).add(-evening_offset, "m");
        evening_start_time = evening_end_time.add(-evening_minutes, "m");
        // 次にそれを文字列にする
        morning_start_time = morning_start_time.format("HH:mm");
        morning_end_time = morning_end_time.format("HH:mm");
        evening_start_time = evening_start_time.format("HH:mm");
        evening_end_time = evening_end_time.format("HH:mm");
        $("#morning_start_time").text(morning_start_time);
        $("#evening_start_time").text(evening_start_time);
        $("#morning_end_time").text(morning_end_time);
        $("#evening_end_time").text(evening_end_time);
        console.log(dayjs(), "暦取得成功");
    }).fail(function() {
        console.log("暦取得失敗");
    });
};

function getTimeMode() {
    getNow();
    let msg = ""
    const now = time.slice(0, 5)            // HH:mm:ss を HH:mm にする
    // 現在がどの時刻モードかを調べる　これは毎秒おこなう必要がある
    switch (true) {                         // ここは優先順位として大きい値から判断していく
        case now >= evening_end_time:       // 日の入り以降は強制OFF
            mode = "夜";
            break;
        case now >= evening_start_time:     // 日の入り1.5H前以降は強制ON
            mode = "夕方";
            break;
        case now >= morning_end_time:       // 日の出1.5H後以降は自動制御
            mode = "昼";
            break;
        case now >= morning_start_time:     // 日の出以降は強制ON
            mode = "朝";
            break;
        default:                            // それ以前（0時以降）は強制OFF
            mode = "夜";
    };

    // 時刻モードが変更になったときのみ以下の処理をおこなう
    if (mode != lastmode) {
        switch (mode) {
            case "夜":
                //mode = "強制OFF";
                msg = "　夜です　";
                isForce = true;
                isLED = false;
                enpowerLED(isLED);
                break;
            case "夕方":
                //mode = "強制ON";
                msg = "　夕方です　";
                isForce = true;
                isLED = true;
                enpowerLED(isLED);
                break;
            case "昼":
                //mode = "自動制御";
                msg = "　昼です　";
                isForce = false;
                break;
            case "朝":
                //mode = "強制ON";
                msg = "　朝です　";
                isForce = true;
                isLED = true;
                enpowerLED(isLED);
                break;
        };
        addMsg(time + msg + "モード変更　" + mode);
    }
    $("#mode").text(mode);
    lastmode = mode;
}



//////////////////////////////////////////////////////////////////////
//    バッテリ電圧
//////////////////////////////////////////////////////////////////////
// バッテリーの設定を取得する関数
async function getBattSetting() {
    await $.ajax("/getBattSetting", {
        type: "POST",
    }).done(function(data) {
        const dict = JSON.parse(data);
        console.log(dict);
        Ah = Number(dict["Ah"]);
        pow = Number(dict["power"]);
        cnt = Number(dict["cnt"]);
        voltage = Number(dict["voltage"]);
        BTcnt = Number(dict["BTcnt"]);
        charge = Number(dict["charge"]);
        capa = Ah * voltage * BTcnt / 2;
        red3h = pow * cnt * 1.5;
        yellow3h = pow * cnt * 3;
        console.log("バッテリー設定取得成功");
    }).fail(function() {
        console.log("バッテリー設定取得失敗");
    });
};


//
async function getBatt(isTry) {
    let bat = 0;
    await $.ajax("/getBatt", {
        type: "post",
        data: {"isTry": isTry},              // テストか本番かのbool値をisTryとして送る
    }).done(function(data) {
        const dict = JSON.parse(data);
        bat = dict["ana3"];
    }).fail(function() {
        console.log("バッテリー電圧取得失敗");
    });
    showBatt(bat);
    return bat
}


// バッテリーの設定を表示する関数
function showBatt(bp) {
    maxwh = Math.trunc(Ah * voltage * BTcnt / 2);
    maxv = voltage;
    wh = Math.trunc(maxwh*bp/100);
    volt = Math.trunc(maxv*bp/100);
    charge = Math.trunc(charge*.3);
    totalwh = Math.trunc(wh+charge);
    need_next = Math.trunc(pow*cnt*1);
    redp = Math.trunc(red3h/maxwh*100);

    $("#vp").text(bp);          // パーセント
    $("#wh").text(wh);
    $("#maxwh").text(maxwh);
    $("#volt").text(volt);
    $("#maxv").text(maxv);
    $("#calc_red3h").html(pow+"W*"+cnt+"本*1.5h="+red3h+"Wh");
    $("#calc_totalwh").html(wh+"Wh+"+charge+"Wh="+totalwh+"Wh");
    $("totalwh").html(totalwh);
    $("#calc_next").html(pow+"W*"+cnt+"*1h="+need_next+"Wh");
    $("#batt-black").css("width", (100-bp)+"%");
}


//////////////////////////////////////////////////////////////////////
//    設定
//////////////////////////////////////////////////////////////////////
// 設定ファイルを取得する関数
async function getConfig() {
    await $.ajax("/getConfig", {
        type: "POST",
    }).done(function(data) {
        const dict = JSON.parse(data);
        $("#place").val(dict["place"]);
        $("#lat").val(dict["lat"]);
        $("#lon").val(dict["lon"]);
        $("#elev").val(dict["elev"]);
        $("#morning_offset").val(dict["morning_offset"]);
        $("#evening_offset").val(dict["evening_offset"]);
        $("#morning_minutes").val(dict["morning_minutes"]);
        $("#evening_minutes").val(dict["evening_minutes"]);
        console.log("設定ファイル取得成功");
        console.log(dict);
    }).fail(function() {
        console.log("設定ファイル取得失敗");
    });
};

// 設定ファイルを変更する関数
async function setConfig() {
    const place = $("#place").val();
    const lat = $("#lat").val();
    const lon = $("#lon").val();
    const elev = $("#elev").val();
    const morning_offset = $("#morning_offset").val();
    const evening_offset = $("#evening_offset").val();
    const morning_minutes = $("#morning_minutes").val();
    const evening_minutes = $("#evening_minutes").val();
    const dict = {"place": place, "lat": lat, "lon": lon, "elev": elev,
                  "morning_offset": morning_offset, "evening_offset": evening_offset,
                  "morning_minutes": morning_minutes, "evening_minutes": evening_minutes};
    console.log("設定変更" + dict)
    await $.ajax("/setConfig", {
        type: "POST",
        data: dict,
    }).done(function(data) {
        console.log("設定ファイル変更成功");
        console.log(dict);
    }).fail(function() {
        console.log("設定ファイル変更失敗");
    });
};
