// =====================================================
// ملعب العزيمة 14
// script.js - Supabase + WhatsApp
// =====================================================


// ================= SUPABASE =================

const SUPABASE_URL =
    "https://yoflvktmovseppukqdio.supabase.co";

const SUPABASE_KEY =
    "sb_publishable_L9U9B8viS8bD85N1kmUm5g_qM5YpQ3a";


const supabaseClient =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );


// ================= SETTINGS =================

const defaultSettings = {

    dayPrice: 70,

    nightPrice: 80,

    nightStart: "19:30",

    open: "17:00",

    close: "01:00",

    ownerOne: "201116733739",

    ownerTwo: ""

};


let settings = {
    ...defaultSettings
};


// ================= DATA =================

let bookings = [];

let selectedSlot = null;


// ================= ELEMENTS =================

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


// ================= YEAR =================

const yearElement =
    document.getElementById("year");

if(yearElement){

    yearElement.textContent =
        new Date().getFullYear();

}


// ================= HELPERS =================

function pad(n){

    return String(n)
        .padStart(2, "0");

}


// ================= LOCAL DATE =================

function localISODate(
    d = new Date()
){

    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

}


// ================= FUTURE DATE =================

function futureDate(days){

    const d =
        new Date();

    d.setDate(
        d.getDate() + days
    );

    return localISODate(d);

}


// ================= TIME =================

function timeToMinutes(time){

    if(!time)
        return 0;


    const parts =
        time
        .toString()
        .split(":")
        .map(Number);


    return (
        (parts[0] || 0) * 60 +
        (parts[1] || 0)
    );

}


// ================= TIME DISPLAY =================

function minutesToTime(minutes){

    minutes =
        ((minutes % 1440) + 1440) % 1440;


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


// ================= DATE LABEL =================

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


// ================= END TIME =================

function endTime(
    start,
    duration
){

    let result =
        timeToMinutes(start)
        +
        Number(duration);


    result =
        result % 1440;


    return `${pad(
        Math.floor(result / 60)
    )}:${pad(
        result % 60
    )}`;

}


// ================= PRICE =================

function priceFor(
    start,
    duration
){

    const startMinutes =
        timeToMinutes(start);


    const nightStart =
        timeToMinutes(
            settings.nightStart
        );


    const hourly =
        startMinutes >= nightStart
        ?
        Number(settings.nightPrice)
        :
        Number(settings.dayPrice);


    return hourly *
        (Number(duration) / 60);

}


// ================= LOAD SETTINGS =================

async function loadSettingsFromSupabase(){

    try{

        const {
            data,
            error
        } =
            await supabaseClient
            .from("settings")
            .select(`
                day_price,
                night_price,
                night_start,
                opening_time,
                closing_time,
                owner_one_phone,
                owner_two_phone
            `)
            .eq("id", 1)
            .maybeSingle();


        if(error){

            console.warn(
                "Settings error:",
                error.message
            );

            return;

        }


        if(data){

            settings.dayPrice =
                Number(
                    data.day_price
                );


            settings.nightPrice =
                Number(
                    data.night_price
                );


            settings.nightStart =
                data.night_start ||
                defaultSettings.nightStart;


            settings.open =
                data.opening_time ||
                defaultSettings.open;


            settings.close =
                data.closing_time ||
                defaultSettings.close;


            settings.ownerOne =
                data.owner_one_phone ||
                defaultSettings.ownerOne;


            settings.ownerTwo =
                data.owner_two_phone ||
                "";

        }

    }

    catch(error){

        console.warn(
            "Could not load settings:",
            error
        );

    }

}


// ================= MAKE SLOTS =================

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


    for(
        let m = openMinutes;

        m < 1440;

        m += 60
    ){

        slots.push(
            `${pad(
                Math.floor(m / 60)
            )}:${pad(
                m % 60
            )}`
        );

    }


    for(
        let m = 0;

        m < closeMinutes;

        m += 60
    ){

        slots.push(
            `${pad(
                Math.floor(m / 60)
            )}:${pad(
                m % 60
            )}`
        );

    }


    return slots;

}


// ================= NORMALIZE TIME =================

function normalizeMinutes(x){

    return x < 300
        ? x + 1440
        : x;

}


// ================= OVERLAP =================

function rangesOverlap(
    aStart,
    aEnd,
    bStart,
    bEnd
){

    let aS =
        normalizeMinutes(
            timeToMinutes(aStart)
        );


    let aE =
        normalizeMinutes(
            timeToMinutes(aEnd)
        );


    let bS =
        normalizeMinutes(
            timeToMinutes(bStart)
        );


    let bE =
        normalizeMinutes(
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


// ================= WEEKLY DATE =================

function bookingAffectsDate(
    booking,
    date
){

    if(
        booking.booking_date === date
    ){

        return true;

    }


    if(
        booking.booking_type === "weekly" &&
        booking.booking_date < date
    ){

        const start =
            new Date(
                booking.booking_date +
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
                !booking.weekly_end_date ||
                date <= booking.weekly_end_date
            )

        );

    }


    return false;

}


// ================= OCCUPIED =================

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
                booking.start_time,
                booking.end_time
            )

    );

}


// ================= LOAD BOOKINGS =================

async function loadBookingsFromSupabase(){

    try{

        const {
            data,
            error
        } =
            await supabaseClient
            .from("bookings")
            .select(`
                id,
                customer_name,
                customer_phone,
                booking_date,
                start_time,
                end_time,
                duration_minutes,
                price,
                booking_type,
                weekly_end_date,
                status,
                created_at
            `)
            .order(
                "booking_date",
                {
                    ascending: true
                }
            );


        if(error){

            console.error(
                "Bookings error:",
                error
            );


            showMessage(
                "تعذر تحميل المواعيد من الخادم.",
                true
            );


            return false;

        }


        bookings =
            Array.isArray(data)
            ? data
            : [];


        return true;

    }

    catch(error){

        console.error(
            error
        );


        showMessage(
            "حدث خطأ أثناء تحميل المواعيد.",
            true
        );


        return false;

    }

}


// ================= MESSAGE =================

function showMessage(
    text,
    error = false
){

    if(!messageEl)
        return;


    messageEl.textContent =
        text;


    messageEl.classList.remove(
        "hidden",
        "error"
    );


    if(error){

        messageEl.classList.add(
            "error"
        );

    }

}


// ================= RENDER SLOTS =================

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


                        button.classList.add(
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


// ================= SUMMARY =================

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


// ================= WHATSAPP =================

function openWhatsApp(
    booking
){

    const owner =
        settings.ownerOne;


    if(!owner){

        console.warn(
            "Owner WhatsApp number is missing."
        );

        return;

    }


    const phone =
        String(owner)
        .replace(
            /\D/g,
            ""
        );


    const message =

`⚽ طلب حجز جديد - ملعب العزيمة 14

👤 الاسم: ${booking.customer_name}

📱 الموبايل: ${booking.customer_phone}

📅 التاريخ: ${dateLabel(booking.booking_date)}

⏰ الوقت: ${minutesToTime(
    timeToMinutes(
        booking.start_time
    )
)} - ${minutesToTime(
    timeToMinutes(
        booking.end_time
    )
)}

⏱️ المدة: ${booking.duration_minutes} دقيقة

💰 السعر: ${booking.price} جنيه

${
    booking.booking_type === "weekly"
    ?
    `🔄 حجز أسبوعي
📆 ينتهي: ${booking.weekly_end_date || "غير محدد"}`
    :
    "📌 حجز لمرة واحدة"
}

🟡 الحالة: في انتظار التأكيد`;


    const url =
        "https://wa.me/" +
        phone +
        "?text=" +
        encodeURIComponent(
            message
        );


    window.location.href =
        url;

}


// ================= BOOKING TYPE =================

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


// ================= DATE =================

dateInput.value =
    futureDate(1);


dateInput.min =
    localISODate();


weeklyEndDate.min =
    dateInput.value;


dateInput.addEventListener(
    "change",
    async () => {

        weeklyEndDate.min =
            dateInput.value;


        await loadBookingsFromSupabase();

        renderSlots();

    }
);


// ================= DURATION =================

durationInput.addEventListener(
    "change",
    renderSlots
);


// ================= SUBMIT =================

bookingForm.addEventListener(
    "submit",
    async event => {

        event.preventDefault();


        if(!selectedSlot){

            showMessage(
                "اختار موعد أولًا.",
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


        // تحديث الحجوزات من Supabase
        // قبل التسجيل لمنع الحجز المزدوج

        const loaded =
            await loadBookingsFromSupabase();


        if(!loaded)
            return;


        if(
            isOccupied(
                dateInput.value,
                selectedSlot.start,
                selectedSlot.duration
            )
        ){

            showMessage(
                "الموعد لم يعد متاحًا. اختار موعدًا آخر.",
                true
            );


            renderSlots();

            return;

        }


        // تعطيل الزر مؤقتًا

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


        const bookingData = {

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

        };


        try{

            const {
                data,
                error
            } =
                await supabaseClient
                .from("bookings")
                .insert(
                    bookingData
                )
                .select()
                .single();


            if(error){

                console.error(
                    "Insert booking error:",
                    error
                );


                if(
                    error.code ===
                    "23505"
                ){

                    showMessage(
                        "الموعد تم حجزه بالفعل. اختار موعدًا آخر.",
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


            // إضافة الحجز للقائمة المحلية
            bookings.push(
                data
            );


            showMessage(
                "تم تسجيل طلب الحجز بنجاح ✅ سيتم فتح واتساب المالك الآن."
            );


            // فتح واتساب
            setTimeout(
                () => {

                    openWhatsApp(
                        data
                    );

                },
                400
            );


            bookingForm.reset();


            selectedSlot =
                null;


            await loadBookingsFromSupabase();

            renderSlots();

        }

        catch(error){

            console.error(
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
);


// ================= START =================

async function initialize(){

    showMessage(
        "جاري تحميل المواعيد..."
    );


    await loadSettingsFromSupabase();


    const loaded =
        await loadBookingsFromSupabase();


    if(loaded){

        if(messageEl){

            messageEl.classList.add(
                "hidden"
            );

        }

        renderSlots();

    }

}


// تشغيل الموقع

initialize();
