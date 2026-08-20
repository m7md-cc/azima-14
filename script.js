/* =========================================================
   SUPABASE
========================================================= */

const SUPABASE_URL =
    "https://yoflvktmovseppukqdio.supabase.co";

const SUPABASE_KEY =
    "sb_publishable_L9U9B8viS8bD85N1kmUm5g_qM5YpQ3a";

const supabaseClient =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );


/* =========================================================
   SETTINGS
========================================================= */

const defaultSettings = {

    dayPrice: 70,

    nightPrice: 80,

    nightStart: "19:30:00",

    open: "17:00:00",

    close: "01:00:00",

    ownerOne: "201116733739",

    ownerTwo: ""

};


let settings = {
    ...defaultSettings
};


/* =========================================================
   STATE
========================================================= */

let bookings = [];

let selectedSlot = null;

let loadingBookings = false;


/* =========================================================
   DOM
========================================================= */

const dateInput =
    document.getElementById(
        "bookingDate"
    );


const durationInput =
    document.getElementById(
        "duration"
    );


const slotsEl =
    document.getElementById(
        "slots"
    );


const selectedSummary =
    document.getElementById(
        "selectedSummary"
    );


const bookingForm =
    document.getElementById(
        "bookingForm"
    );


const weeklyOptions =
    document.getElementById(
        "weeklyOptions"
    );


const weeklyEndDate =
    document.getElementById(
        "weeklyEndDate"
    );


const messageEl =
    document.getElementById(
        "message"
    );


const yearEl =
    document.getElementById(
        "year"
    );


if(yearEl){

    yearEl.textContent =
        new Date().getFullYear();

}


/* =========================================================
   BASIC HELPERS
========================================================= */

function pad(n){

    return String(n)
        .padStart(2, "0");

}


function localISODate(
    d = new Date()
){

    return (
        `${d.getFullYear()}-` +
        `${pad(d.getMonth() + 1)}-` +
        `${pad(d.getDate())}`
    );

}


function futureDate(days){

    const d =
        new Date();

    d.setDate(
        d.getDate() + days
    );

    return localISODate(d);

}


/* =========================================================
   TIME
========================================================= */

function timeToMinutes(time){

    if(!time)
        return 0;

    const parts =
        String(time)
        .substring(0, 5)
        .split(":")
        .map(Number);

    const h =
        parts[0] || 0;

    const m =
        parts[1] || 0;

    return (
        h * 60 +
        m
    );

}


function minutesToTime(minutes){

    minutes =
        ((minutes % 1440) + 1440) %
        1440;

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

    return (
        `${hh}:${pad(m)} ${suffix}`
    );

}


function timeStringFromMinutes(
    minutes
){

    minutes =
        ((minutes % 1440) + 1440) %
        1440;

    return (
        `${pad(
            Math.floor(minutes / 60)
        )}:${pad(
            minutes % 60
        )}:00`
    );

}


/* =========================================================
   DATE
========================================================= */

function dateLabel(value){

    const d =
        new Date(
            value + "T12:00:00"
        );

    return new Intl.DateTimeFormat(
        "ar-EG",
        {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric"
        }
    ).format(d);

}


/* =========================================================
   END TIME
========================================================= */

function endTime(
    start,
    duration
){

    const result =
        timeToMinutes(start) +
        Number(duration);

    return timeStringFromMinutes(
        result
    );

}


/* =========================================================
   PRICING
=========================================================

   القاعدة:

   17:00 → قبل 19:30
   = سعر النهار

   لو الحجز يبدأ قبل 19:30
   لكنه يمتد إلى 19:30 أو بعدها
   = سعر الليل كاملًا

   مثال:
   19:00 → 20:00
   = 80 جنيه

========================================================= */

function priceFor(
    start,
    duration
){

    const startMinutes =
        timeToMinutes(start);

    const endMinutes =
        startMinutes +
        Number(duration);

    const nightStart =
        timeToMinutes(
            settings.nightStart
        );

    const crossesNight =
        endMinutes >
        nightStart;

    const startsAtNight =
        startMinutes >=
        nightStart;

    const hourlyPrice =
        (
            startsAtNight ||
            crossesNight
        )
        ?
        Number(settings.nightPrice)
        :
        Number(settings.dayPrice);

    return (
        hourlyPrice *
        (Number(duration) / 60)
    );

}


/* =========================================================
   SLOTS
========================================================= */

function makeSlots(){

    const slots = [];

    const openMinutes =
        timeToMinutes(
            settings.open
        );

    const closeMinutes =
        timeToMinutes(
            settings.close
        );


    /*
        الملعب من 17:00
        حتى 01:00 بعد منتصف الليل
    */

    for(
        let m = openMinutes;

        m < 1440;

        m += 60
    ){

        slots.push(
            timeStringFromMinutes(m)
        );

    }


    for(
        let m = 0;

        m < closeMinutes;

        m += 60
    ){

        slots.push(
            timeStringFromMinutes(m)
        );

    }


    return slots;

}


/* =========================================================
   OVERLAP
========================================================= */

function rangesOverlap(
    aStart,
    aEnd,
    bStart,
    bEnd
){

    let aS =
        timeToMinutes(aStart);

    let aE =
        timeToMinutes(aEnd);

    let bS =
        timeToMinutes(bStart);

    let bE =
        timeToMinutes(bEnd);


    /*
        أي وقت بعد منتصف الليل
        نعتبره تابعًا لليوم السابق.
    */

    if(aS < 300)
        aS += 1440;

    if(aE < 300)
        aE += 1440;

    if(bS < 300)
        bS += 1440;

    if(bE < 300)
        bE += 1440;


    if(aE <= aS)
        aE += 1440;

    if(bE <= bS)
        bE += 1440;


    return (
        aS < bE &&
        bS < aE
    );

}


/* =========================================================
   MESSAGE
========================================================= */

function showMessage(
    text,
    error = false
){

    if(!messageEl)
        return;

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


/* =========================================================
   SUPABASE SETTINGS
========================================================= */

async function loadSettingsFromSupabase(){

    try{

        const {
            data,
            error
        } =
            await supabaseClient
                .from("settings")
                .select(`
                    id,
                    day_price,
                    night_price,
                    night_start,
                    opening_time,
                    closing_time,
                    owner_one_phone,
                    owner_two_phone
                `)
                .eq("id", 1)
                .single();


        if(error){

            console.error(
                "Settings error:",
                error
            );

            showMessage(
                "تعذر تحميل إعدادات الملعب.",
                true
            );

            return false;

        }


        settings = {

            dayPrice:
                Number(
                    data.day_price
                ),

            nightPrice:
                Number(
                    data.night_price
                ),

            nightStart:
                data.night_start ||
                defaultSettings.nightStart,

            open:
                data.opening_time ||
                defaultSettings.open,

            close:
                data.closing_time ||
                defaultSettings.close,

            ownerOne:
                data.owner_one_phone ||
                "",

            ownerTwo:
                data.owner_two_phone ||
                ""

        };


        return true;

    }

    catch(error){

        console.error(
            "Settings exception:",
            error
        );

        showMessage(
            "حدث خطأ أثناء تحميل إعدادات الملعب.",
            true
        );

        return false;

    }

}


/* =========================================================
   LOAD BOOKINGS FOR A DATE
========================================================= */

async function loadBookingsForDate(
    date
){

    loadingBookings = true;


    try{

        const {
            data,
            error
        } =
            await supabaseClient
                .rpc(
                    "get_booked_slots",
                    {
                        p_date: date
                    }
                );


        if(error){

            console.error(
                "Bookings read error:",
                error
            );

            showMessage(
                "تعذر تحميل المواعيد المحجوزة.",
                true
            );

            bookings = [];

            return false;

        }


        bookings =
            Array.isArray(data)
            ?
            data.map(
                booking => ({

                    start:
                        booking.start_time,

                    end:
                        booking.end_time,

                    status:
                        "confirmed"

                })
            )
            :
            [];


        return true;

    }

    catch(error){

        console.error(
            "Bookings exception:",
            error
        );

        bookings = [];

        showMessage(
            "حدث خطأ أثناء تحميل المواعيد.",
            true
        );

        return false;

    }

    finally{

        loadingBookings = false;

    }

}


/* =========================================================
   OCCUPIED
========================================================= */

function isOccupied(
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
            rangesOverlap(
                start,
                end,
                booking.start,
                booking.end
            )
    );

}


/* =========================================================
   RENDER SLOTS
========================================================= */

async function renderSlots(){

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


    if(!date)
        return;


    document.getElementById(
        "selectedDateLabel"
    ).textContent =
        dateLabel(date);


    slotsEl.innerHTML =
        `
        <div class="muted">
            جاري تحميل المواعيد...
        </div>
        `;


    const success =
        await loadBookingsForDate(
            date
        );


    if(!success){

        slotsEl.innerHTML = "";

        return;

    }


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
                    start,
                    duration
                );


            const button =
                document.createElement(
                    "button"
                );


            button.type =
                "button";


            button.className =
                "slot " +
                (
                    occupied
                    ?
                    "booked"
                    :
                    "available"
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


/* =========================================================
   SUMMARY
========================================================= */

function renderSummary(){

    if(!selectedSlot)
        return;


    const type =
        document.querySelector(
            'input[name="bookingType"]:checked'
        ).value;


    const duration =
        selectedSlot.duration;


    const durationText =
        duration === 60
        ?
        "ساعة"
        :
        duration === 90
        ?
        "ساعة ونصف"
        :
        "ساعتان";


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
        ${durationText}

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


/* =========================================================
   BOOKING TYPE
========================================================= */

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
                        .add(
                            "active"
                        );


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


/* =========================================================
   DATE
========================================================= */

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


/* =========================================================
   DURATION
========================================================= */

durationInput.addEventListener(
    "change",
    () => {

        renderSlots();

    }
);


/* =========================================================
   CREATE BOOKING
========================================================= */

async function createBooking(){

    if(!selectedSlot){

        showMessage(
            "اختار موعد الحجز أولًا.",
            true
        );

        return;

    }


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
        null;


    if(!name){

        showMessage(
            "اكتب اسمك.",
            true
        );

        return;

    }


    if(!phone){

        showMessage(
            "اكتب رقم الموبايل.",
            true
        );

        return;

    }


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


    /*
        فحص جديد من قاعدة البيانات
        قبل إنشاء الحجز.
    */

    showMessage(
        "جاري التأكد من توفر الموعد..."
    );


    const latest =
        await supabaseClient
            .rpc(
                "get_booked_slots",
                {
                    p_date:
                        dateInput.value
                }
            );


    if(latest.error){

        console.error(
            latest.error
        );

        showMessage(
            "تعذر التأكد من توفر الموعد.",
            true
        );

        return;

    }


    const latestBookings =
        latest.data || [];


    const latestOccupied =
        latestBookings.some(
            booking =>
                rangesOverlap(
                    selectedSlot.start,
                    selectedSlot.end,
                    booking.start_time,
                    booking.end_time
                )
        );


    if(latestOccupied){

        showMessage(
            "الموعد تم حجزه بالفعل. اختار موعدًا آخر.",
            true
        );

        await renderSlots();

        return;

    }


    const submitButton =
        bookingForm.querySelector(
            'button[type="submit"]'
        );


    if(submitButton){

        submitButton.disabled =
            true;

        submitButton.textContent =
            "جاري تسجيل الحجز...";

    }


    try{

        const {
            error
        } =
            await supabaseClient
                .from("bookings")
                .insert({

                    customer_name:
                        name,

                    customer_phone:
                        phone,

                    booking_date:
                        dateInput.value,

                    start_time:
                        selectedSlot.start,

                    end_time:
                        selectedSlot.end,

                    duration_minutes:
                        selectedSlot.duration,

                    price:
                        selectedSlot.price,

                    booking_type:
                        type,

                    weekly_end_date:
                        endDate,

                    status:
                        "pending"

                });


        if(error){

            console.error(
                "Booking insert error:",
                error
            );


            if(
                error.code ===
                "42501"
            ){

                showMessage(
                    "قاعدة البيانات رفضت إنشاء الحجز. نحتاج ضبط صلاحية INSERT في Supabase.",
                    true
                );

            }

            else{

                showMessage(
                    "حدث خطأ أثناء تسجيل الحجز: " +
                    error.message,
                    true
                );

            }

            return;

        }


        showMessage(
            "تم تسجيل طلب الحجز بنجاح ✅ سيتم التواصل معك لتأكيد الموعد."
        );


        bookingForm.reset();


        selectedSlot =
            null;


        selectedSummary
            .classList
            .add("hidden");


        bookingForm
            .classList
            .add("hidden");


        await renderSlots();

    }

    catch(error){

        console.error(
            "Create booking exception:",
            error
        );

        showMessage(
            "حدث خطأ غير متوقع أثناء تسجيل الحجز.",
            true
        );

    }

    finally{

        if(submitButton){

            submitButton.disabled =
                false;

            submitButton.textContent =
                "تأكيد طلب الحجز";

        }

    }

}


/* =========================================================
   FORM SUBMIT
========================================================= */

bookingForm.addEventListener(
    "submit",
    async event => {

        event.preventDefault();

        await createBooking();

    }
);


/* =========================================================
   INITIALIZATION
========================================================= */

async function initialize(){

    showMessage(
        "جاري تحميل إعدادات الملعب..."
    );


    const settingsLoaded =
        await loadSettingsFromSupabase();


    if(!settingsLoaded){

        return;

    }


    /*
        نخفي رسالة التحميل
        قبل عرض المواعيد.
    */

    messageEl
        .classList
        .add("hidden");


    await renderSlots();

}


initialize();
