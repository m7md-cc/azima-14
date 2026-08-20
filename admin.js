hereconst STORAGE_KEY =
    "alazima14_bookings_v1";

const SETTINGS_KEY =
    "alazima14_settings_v1";

const AUTH_KEY =
    "alazima14_admin_auth_v1";


const ADMIN_PIN =
    "1414";


const defaultSettings = {

    dayPrice:70,

    nightPrice:80,

    nightStart:"19:30",

    open:"17:00",

    close:"01:00",

    ownerOne:"201116733739",

    ownerTwo:""

};


let settings =
    loadSettings();


let bookings =
    loadBookings();



const loginPanel =
    document.getElementById(
        "loginPanel"
    );


const dashboard =
    document.getElementById(
        "dashboard"
    );


document.getElementById(
    "year"
).textContent =
    new Date().getFullYear();



function pad(n){

    return String(n)
        .padStart(2,"0");

}



function localISODate(
    d = new Date()
){

    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

}



function loadSettings(){

    try{

        return {

            ...defaultSettings,

            ...JSON.parse(
                localStorage.getItem(
                    SETTINGS_KEY
                ) || "{}"
            )

        };

    }

    catch{

        return {
            ...defaultSettings
        };

    }

}



function loadBookings(){

    try{

        const data =
            JSON.parse(
                localStorage.getItem(
                    STORAGE_KEY
                )
            );


        return Array.isArray(data)
            ? data
            : [];

    }

    catch{

        return [];

    }

}



function saveBookings(){

    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(
            bookings
        )
    );

}



function saveSettings(){

    localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify(
            settings
        )
    );

}



function timeToMinutes(time){

    const [
        h,
        m
    ] =
        time
        .split(":")
        .map(Number);


    return h * 60 + m;

}



function minutesToTime(minutes){

    minutes %= 1440;


    const h =
        Math.floor(
            minutes / 60
        );


    const m =
        minutes % 60;


    const suffix =
        h < 12
        ?
        "ص"
        :
        "م";


    const hh =
        h % 12 || 12;


    return `${hh}:${pad(m)} ${suffix}`;

}



function dateLabel(value){

    return new Intl.DateTimeFormat(
        "ar-EG",
        {
            weekday:"long",
            day:"numeric",
            month:"long"
        }
    ).format(
        new Date(
            value +
            "T12:00:00"
        )
    );

}



function endTime(
    start,
    duration
){

    let result =
        timeToMinutes(start)
        +
        duration;


    if(result >= 1440)
        result -= 1440;


    return `${pad(
        Math.floor(
            result / 60
        )
    )}:${pad(
        result % 60
    )}`;

}



function makeSlots(){

    const slots = [];


    for(
        let m =
            timeToMinutes(
                settings.open
            );

        m < 1440;

        m += 60
    ){

        slots.push(
            `${pad(
                Math.floor(m/60)
            )}:${pad(
                m%60
            )}`
        );

    }


    for(
        let m = 0;

        m <
        timeToMinutes(
            settings.close
        );

        m += 60
    ){

        slots.push(
            `${pad(
                Math.floor(m/60)
            )}:${pad(
                m%60
            )}`
        );

    }


    return slots;

}



function normalize(x){

    return x < 300
        ?
        x + 1440
        :
        x;

}



function overlap(
    aStart,
    aEnd,
    bStart,
    bEnd
){

    let aS =
        normalize(
            timeToMinutes(
                aStart
            )
        );


    let aE =
        normalize(
            timeToMinutes(
                aEnd
            )
        );


    let bS =
        normalize(
            timeToMinutes(
                bStart
            )
        );


    let bE =
        normalize(
            timeToMinutes(
                bEnd
            )
        );


    if(aE <= aS)
        aE += 1440;


    if(bE <= bS)
        bE += 1440;


    return (
        aS < bE &&
        bS < aE
    );

}



function affects(
    booking,
    date
){

    if(
        booking.date === date
    )
        return true;


    if(
        booking.type === "weekly" &&
        booking.date < date
    ){

        const start =
            new Date(
                booking.date +
                "T12:00:00"
            );


        const target =
            new Date(
                date +
                "T12:00:00"
            );


        const diff =
            Math.round(
                (target-start)
                /
                86400000
            );


        return (

            diff > 0 &&

            diff % 7 === 0 &&

            (
                !booking.endDate ||
                date <=
                booking.endDate
            )

        );

    }


    return false;

}



function show(
    id,
    text,
    error=false
){

    const element =
        document.getElementById(id);


    element.textContent =
        text;


    element.classList
        .remove(
            "hidden",
            "error"
        );


    if(error)
        element.classList
            .add("error");

}



function render(){

    const date =
        document.getElementById(
            "adminDate"
        ).value;


    const active =
        bookings.filter(
            booking =>
                booking.status !==
                "cancelled"
        );


    const today =
        localISODate();


    document.getElementById(
        "todayCount"
    ).textContent =
        active.filter(
            booking =>
                affects(
                    booking,
                    today
                )
        ).length;


    document.getElementById(
        "upcomingCount"
    ).textContent =
        active.filter(
            booking =>
                booking.date >= today
        ).length;


    document.getElementById(
        "revenue"
    ).textContent =

        active.reduce(
            (
                total,
                booking
            ) =>
                total +
                Number(
                    booking.price ||
                    0
                ),

            0
        )
        +
        " ج";



    const dayBookings =
        active.filter(
            booking =>
                affects(
                    booking,
                    date
                )
        );



    const slots =
        document.getElementById(
            "adminSlots"
        );


    slots.innerHTML = "";



    makeSlots().forEach(
        start => {

            const found =
                dayBookings.find(
                    booking =>
                        overlap(
                            start,
                            endTime(
                                start,
                                60
                            ),
                            booking.start,
                            booking.end
                        )
                );


            const div =
                document.createElement(
                    "div"
                );


            div.className =
                "slot " +
                (
                    found
                    ?
                    "booked"
                    :
                    "available"
                );


            div.innerHTML = `

                <strong>

                    ${minutesToTime(
                        timeToMinutes(
                            start
                        )
                    )}

                    -

                    ${minutesToTime(
                        timeToMinutes(
                            endTime(
                                start,
                                60
                            )
                        )
                    )}

                </strong>


                <small>

                    ${
                        found
                        ?
                        "🔴 " +
                        found.name
                        :
                        "🟢 متاح"
                    }

                </small>

            `;


            slots.appendChild(
                div
            );

        }
    );



    const list =
        document.getElementById(
            "bookingList"
        );


    list.innerHTML = "";



    if(!bookings.length){

        list.innerHTML =
            '<p class="muted">لا توجد حجوزات حتى الآن.</p>';

        return;

    }



    bookings
        .slice()
        .sort(
            (a,b) =>
                (
                    a.date +
                    a.start
                )
                .localeCompare(
                    b.date +
                    b.start
                )
        )
        .forEach(
            booking => {

                const item =
                    document.createElement(
                        "div"
                    );


                item.className =
                    "booking-item";


                item.innerHTML = `

                    <strong>

                        ${booking.name}

                        ${
                            booking.type ===
                            "weekly"
                            ?
                            " 🔄"
                            :
                            ""
                        }

                    </strong>


                    <small>

                        📅
                        ${dateLabel(
                            booking.date
                        )}

                        <br>

                        ⏰
                        ${minutesToTime(
                            timeToMinutes(
                                booking.start
                            )
                        )}

                        -

                        ${minutesToTime(
                            timeToMinutes(
                                booking.end
                            )
                        )}

                        <br>

                        📱
                        ${
                            booking.phone ||
                            "غير مضاف"
                        }

                        ·

                        💰
                        ${booking.price}
                        جنيه

                        <br>

                        الحالة:

                        ${
                            booking.status ===
                            "pending"

                            ?
                            "في انتظار التأكيد"

                            :

                            booking.status ===
                            "confirmed"

                            ?
                            "مؤكد"

                            :
                            "ملغي"
                        }

                    </small>


                    <div class="actions">

                        ${
                            booking.status !==
                            "confirmed"

                            ?

                            `
                            <button
                                data-action="confirm"
                            >
                                تأكيد
                            </button>
                            `

                            :

                            ""
                        }


                        ${
                            booking.status !==
                            "cancelled"

                            ?

                            `
                            <button
                                data-action="cancel"
                            >
                                إلغاء
                            </button>
                            `

                            :

                            ""
                        }

                    </div>

                `;


                item
                    .querySelectorAll(
                        "button"
                    )
                    .forEach(
                        button => {

                            button.addEventListener(
                                "click",
                                () => {

                                    const action =
                                        button
                                        .dataset
                                        .action;


                                    if(
                                        action ===
                                        "confirm"
                                    ){

                                        booking.status =
                                            "confirmed";

                                    }


                                    if(
                                        action ===
                                        "cancel"
                                    ){

                                        booking.status =
                                            "cancelled";

                                    }


                                    saveBookings();

                                    render();

                                }
                            );

                        }
                    );


                list.appendChild(
                    item
                );

            }
        );

}



function login(){

    const pin =
        document
        .getElementById(
            "adminPin"
        )
        .value;


    if(
        pin === ADMIN_PIN
    ){

        sessionStorage.setItem(
            AUTH_KEY,
            "1"
        );


        loginPanel
            .classList
            .add(
                "hidden"
            );


        dashboard
            .classList
            .remove(
                "hidden"
            );


        initDashboard();

    }

    else{

        show(
            "loginMessage",
            "رمز الدخول غير صحيح.",
            true
        );

    }

}



function initDashboard(){

    document.getElementById(
        "adminDate"
    ).value =
        localISODate();


    document.getElementById(
        "dayPrice"
    ).value =
        settings.dayPrice;


    document.getElementById(
        "nightPrice"
    ).value =
        settings.nightPrice;


    document.getElementById(
        "ownerOne"
    ).value =
        settings.ownerOne;


    document.getElementById(
        "ownerTwo"
    ).value =
        settings.ownerTwo;


    render();

}



document
.getElementById(
    "loginBtn"
)
.addEventListener(
    "click",
    login
);



document
.getElementById(
    "adminPin"
)
.addEventListener(
    "keydown",
    event => {

        if(
            event.key ===
            "Enter"
        )
            login();

    }
);



document
.getElementById(
    "logoutBtn"
)
.addEventListener(
    "click",
    () => {

        sessionStorage.removeItem(
            AUTH_KEY
        );

        location.reload();

    }
);



document
.getElementById(
    "adminDate"
)
.addEventListener(
    "change",
    render
);



document
.getElementById(
    "saveSettingsBtn"
)
.addEventListener(
    "click",
    () => {

        settings.dayPrice =
            Number(
                document
                .getElementById(
                    "dayPrice"
                )
                .value
            ) || 0;


        settings.nightPrice =
            Number(
                document
                .getElementById(
                    "nightPrice"
                )
                .value
            ) || 0;


        saveSettings();


        show(
            "settingsMessage",
            "تم حفظ الأسعار بنجاح ✅"
        );

    }
);



document
.getElementById(
    "saveOwnersBtn"
)
.addEventListener(
    "click",
    () => {

        settings.ownerOne =
            document
            .getElementById(
                "ownerOne"
            )
            .value
            .trim();


        settings.ownerTwo =
            document
            .getElementById(
                "ownerTwo"
            )
            .value
            .trim();


        saveSettings();


        show(
            "settingsMessage",
            "تم حفظ أرقام المالكين."
        );

    }
);



document
.getElementById(
    "clearDemoBtn"
)
.addEventListener(
    "click",
    () => {

        if(
            confirm(
                "هل تريد مسح جميع الحجوزات؟"
            )
        ){

            bookings = [];

            saveBookings();

            render();

        }

    }
);



if(
    sessionStorage.getItem(
        AUTH_KEY
    ) === "1"
){

    loginPanel
        .classList
        .add(
            "hidden"
        );


    dashboard
        .classList
        .remove(
            "hidden"
        );


    initDashboard();

}
