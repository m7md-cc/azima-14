const STORAGE_KEY =
    "alazima14_bookings_v1";


const SUPABASE_URL =
    "https://yoflvktmovseppukqdio.supabase.co";


const SUPABASE_KEY =
    "sb_publishable_L9U9B8viS8bD85N1kmUm5g_qM5YpQ3a";


const supabaseClient =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );


const defaultSettings = {

    dayPrice: 70,

    nightPrice: 80,

    nightStart: "19:30",

    open: "17:00",

    close: "01:00",

    ownerOne: "201116733739",

    ownerTwo: ""

};


let settings =
    loadSettings();


let bookings =
    loadBookings();


let selectedSlot =
    null;



const dateInput =
    document.getElementById("bookingDate");


const durationInput =
    document.getElementById("duration");


const slotsEl =
    document.getElementById("slots");


const selectedSummary =
    document.getElementById("selectedSummary");


const bookingForm =
    document.getElementById("bookingForm");


const weeklyOptions =
    document.getElementById("weeklyOptions");


const weeklyEndDate =
    document.getElementById("weeklyEndDate");


const messageEl =
    document.getElementById("message");



document.getElementById("year")
    .textContent =
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



function futureDate(days){

    const d =
        new Date();

    d.setDate(
        d.getDate() + days
    );

    return localISODate(d);

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
        JSON.stringify(bookings)
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

    minutes =
        minutes % 1440;

    const h =
        Math.floor(
            minutes / 60
        );

    const m =
        minutes % 60;

    const suffix =
        h < 12
            ? "ص"
            : "م";

    const hh =
        h % 12 || 12;

    return `${hh}:${pad(m)} ${suffix}`;

}



function dateLabel(value){

    const d =
        new Date(
            value + "T12:00:00"
        );

    return new Intl.DateTimeFormat(
        "ar-EG",
        {
            weekday:"long",
            day:"numeric",
            month:"long",
            year:"numeric"
        }
    ).format(d);

}



function endTime(
    start,
    duration
){

    let result =
        timeToMinutes(start)
        + duration;


    if(result >= 1440){

        result -= 1440;

    }


    return `${pad(
        Math.floor(result / 60)
    )}:${pad(
        result % 60
    )}`;

}



function priceFor(
    start,
    duration
){

    const hourly =
        timeToMinutes(start)
        >=
        timeToMinutes(
            settings.nightStart
        )
        ?
        Number(settings.nightPrice)
        :
        Number(settings.dayPrice);


    return hourly *
        (duration / 60);

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
            `${pad(Math.floor(m/60))}:${pad(m%60)}`
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
            `${pad(Math.floor(m/60))}:${pad(m%60)}`
        );

    }


    return slots;

}



function rangesOverlap(
    aStart,
    aEnd,
    bStart,
    bEnd
){

    const normalize =
        x =>
            x < 300
                ? x + 1440
                : x;


    let aS =
        normalize(
            timeToMinutes(aStart)
        );

    let aE =
        normalize(
            timeToMinutes(aEnd)
        );


    let bS =
        normalize(
            timeToMinutes(bStart)
        );

    let bE =
        normalize(
            timeToMinutes(bEnd)
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



function bookingAffectsDate(
    booking,
    date
){

    if(
        booking.date === date
    ){

        return true;

    }


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


        const difference =
            Math.round(
                (target - start) /
                86400000
            );


        return (
            difference > 0 &&
            difference % 7 === 0 &&
            (
                !booking.endDate ||
                date <= booking.endDate
            )
        );

    }


    return false;

}



function isOccupied(
    date,
    start,
    duration
){

    const end =
        endTime(
            start,
            duration
        );


    return bookings.some(
        booking =>

            booking.status !==
            "cancelled"

            &&

            bookingAffectsDate(
                booking,
                date
            )

            &&

            rangesOverlap(
                start,
                end,
                booking.start,
                booking.end
            )

    );

}



function showMessage(
    text,
    error = false
){

    messageEl.textContent =
        text;

    messageEl.classList
        .remove(
            "hidden",
            "error"
        );


    if(error){

        messageEl.classList
            .add("error");

    }

}



function renderSlots(){

    selectedSlot =
        null;


    selectedSummary
        .classList
        .add("hidden");


    bookingForm
        .classList
        .add("hidden");


    const date =
        dateInput.value;


    document.getElementById(
        "selectedDateLabel"
    ).textContent =
        dateLabel(date);


    slotsEl.innerHTML =
        "";


    const duration =
        Number(
            durationInput.value
        );


    makeSlots().forEach(
        start => {

            const occupied =
                isOccupied(
                    date,
                    start,
                    duration
                );


            const button =
                document.createElement(
                    "button"
                );


            button.className =
                "slot " +
                (
                    occupied
                        ? "booked"
                        : "available"
                );


            button.disabled =
                occupied;


            button.innerHTML = `

                <strong>
                    ${minutesToTime(
                        timeToMinutes(start)
                    )}
                    -
                    ${minutesToTime(
                        timeToMinutes(
                            endTime(
                                start,
                                duration
                            )
                        )
                    )}
                </strong>

                <small>
                    ${
                        occupied
                        ?
                        "🔴 محجوز"
                        :
                        "🟢 متاح"
                    }
                </small>

            `;


            if(!occupied){

                button.addEventListener(
                    "click",
                    () => {

                        selectedSlot = {

                            start,

                            end:
                                endTime(
                                    start,
                                    duration
                                ),

                            duration,

                            price:
                                priceFor(
                                    start,
                                    duration
                                )

                        };


                        [
                            ...slotsEl.children
                        ]
                        .forEach(
                            item =>
                                item.classList
                                .remove(
                                    "selected"
                                )
                        );


                        button.classList
                            .add(
                                "selected"
                            );


                        renderSummary();

                    }
                );

            }


            slotsEl.appendChild(
                button
            );

        }
    );

}



function renderSummary(){

    if(!selectedSlot)
        return;


    const type =
        document.querySelector(
            'input[name="bookingType"]:checked'
        ).value;


    selectedSummary.innerHTML = `

        <strong>
            الموعد المختار
        </strong>

        <br>

        ${dateLabel(
            dateInput.value
        )}

        <br>

        ⏰
        ${minutesToTime(
            timeToMinutes(
                selectedSlot.start
            )
        )}

        -

        ${minutesToTime(
            timeToMinutes(
                selectedSlot.end
            )
        )}

        <br>

        ⏱️
        ${
            selectedSlot.duration === 60
            ?
            "ساعة"
            :
            selectedSlot.duration === 90
            ?
            "ساعة ونصف"
            :
            "ساعتان"
        }

        <br>

        💰
        ${selectedSlot.price}
        جنيه

        ${
            type === "weekly"
            ?
            "<br>🔄 حجز أسبوعي متكرر"
            :
            ""
        }

    `;


    selectedSummary
        .classList
        .remove("hidden");


    bookingForm
        .classList
        .remove("hidden");

}



document
    .querySelectorAll(
        'input[name="bookingType"]'
    )
    .forEach(
        radio => {

            radio.addEventListener(
                "change",
                () => {

                    document
                        .querySelectorAll(
                            ".choice"
                        )
                        .forEach(
                            item =>
                                item.classList
                                .remove(
                                    "active"
                                )
                        );


                    radio
                        .closest(
                            ".choice"
                        )
                        .classList
                        .add("active");


                    const weekly =
                        radio.value ===
                        "weekly";


                    weeklyOptions
                        .classList
                        .toggle(
                            "hidden",
                            !weekly
                        );


                    if(weekly){

                        weeklyEndDate.min =
                            dateInput.value;

                    }


                    renderSummary();

                }
            );

        }
    );



dateInput.value =
    futureDate(1);


dateInput.min =
    localISODate();


weeklyEndDate.min =
    dateInput.value;



dateInput.addEventListener(
    "change",
    () => {

        weeklyEndDate.min =
            dateInput.value;

        renderSlots();

    }
);



durationInput.addEventListener(
    "change",
    renderSlots
);



bookingForm.addEventListener(
    "submit",
    event => {

        event.preventDefault();


        if(!selectedSlot)
            return;


        const name =
            document
            .getElementById(
                "customerName"
            )
            .value
            .trim();


        const phone =
            document
            .getElementById(
                "customerPhone"
            )
            .value
            .trim();


        const type =
            document.querySelector(
                'input[name="bookingType"]:checked'
            ).value;


        const endDate =
            type === "weekly"
            ?
            weeklyEndDate.value
            :
            "";


        if(
            type === "weekly" &&
            (
                !endDate ||
                endDate <
                dateInput.value
            )
        ){

            showMessage(
                "اختار تاريخ نهاية صحيح للحجز الأسبوعي.",
                true
            );

            return;

        }


        if(
            isOccupied(
                dateInput.value,
                selectedSlot.start,
                selectedSlot.duration
            )
        ){

            showMessage(
                "الموعد لم يعد متاحًا. حدّث المواعيد واختر موعدًا آخر.",
                true
            );

            renderSlots();

            return;

        }


        const booking = {

            id:
                "b-" +
                Date.now(),

            name,

            phone,

            date:
                dateInput.value,

            start:
                selectedSlot.start,

            end:
                selectedSlot.end,

            duration:
                selectedSlot.duration,

            price:
                selectedSlot.price,

            type,

            endDate,

            status:
                "pending",

            createdAt:
                new Date().toISOString()

        };


        bookings.push(
            booking
        );


        saveBookings();


        showMessage(
            "تم تسجيل طلب الحجز بنجاح ✅ سيتم التواصل معك لتأكيد الموعد."
        );


        bookingForm.reset();


        renderSlots();

    }
);



renderSlots();


supabaseClient
    .from("settings")
    .select("id, day_price, night_price")
    .eq("id", 1)
    .single()
    .then(({ data, error }) => {

        if (error) {

            alert(
                "خطأ في Supabase:\n" +
                error.message
            );

            return;
        }

        alert(
            "تم الاتصال بـ Supabase بنجاح ✅\n\n" +
            "سعر النهار: " +
            data.day_price +
            "\n" +
            "سعر الليل: " +
            data.night_price
        );

    });
