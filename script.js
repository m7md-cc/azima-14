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

    ownerTwo: "201554093227"

};


let settings = {
    ...defaultSettings
};


// ================= STATE =================

let selectedSlot = null;

let bookedSlots = [];


// ================= ELEMENTS =================

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


function localISODate(
    d = new Date()
){

    return `${d.getFullYear()}-${pad(
        d.getMonth() + 1
    )}-${pad(
        d.getDate()
    )}`;

}


function futureDate(days){

    const d =
        new Date();

    d.setDate(
        d.getDate() + days
    );

    return localISODate(d);

}


function timeToMinutes(time){

    if(!time)
        return 0;

    const [
        h,
        m
    ] =
        String(time)
        .substring(0, 5)
        .split(":")
        .map(Number);

    return (
        (h || 0) * 60 +
        (m || 0)
    );

}


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


function dateLabel(value){

    if(!value)
        return "";

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


function endTime(
    start,
    duration
){

    let result =
        timeToMinutes(start) +
        Number(duration);

    result =
        result % 1440;

    return `${pad(
        Math.floor(result / 60)
    )}:${pad(
        result % 60
    )}`;

}


// ================= SETTINGS =================

async function loadSettings(){

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
                Number(data.day_price);

            settings.nightPrice =
                Number(data.night_price);

            settings.nightStart =
                String(
                    data.night_start
                ).substring(0, 5);

            settings.open =
                String(
                    data.opening_time
                ).substring(0, 5);

            settings.close =
                String(
                    data.closing_time
                ).substring(0, 5);

            settings.ownerOne =
                data.owner_one_phone ||
                "";

            settings.ownerTwo =
                data.owner_two_phone ||
                "";

        }

    }

    catch(error){

        console.warn(
            "Settings exception:",
            error
        );

    }

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

    /*
        لو الحجز يبدأ قبل 7:30 م
        يستخدم سعر النهار.

        لو يبدأ من 7:30 م أو بعده
        يستخدم سعر الليل.
    */

    const hourly =
        startMinutes >= nightStart
            ?
            Number(settings.nightPrice)
            :
            Number(settings.dayPrice);


    return hourly *
        (Number(duration) / 60);

}


// ================= SLOTS =================

function makeSlots(){

    const slots = [];

    const open =
        timeToMinutes(
            settings.open
        );

    const close =
        timeToMinutes(
            settings.close
        );


    /*
        الملعب من 17:00 إلى 01:00
    */

    if(open < 1440){

        for(
            let m = open;

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

    }


    if(close > 0){

        for(
            let m = 0;

            m < close;

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

    }


    return slots;

}


// ================= OVERLAP =================

function rangesOverlap(
    aStart,
    aEnd,
    bStart,
    bEnd
){

    const normalize =
        value => {

            let minutes =
                timeToMinutes(value);

            if(minutes < 300){

                minutes += 1440;

            }

            return minutes;

        };


    let aS =
        normalize(aStart);

    let aE =
        normalize(aEnd);

    let bS =
        normalize(bStart);

    let bE =
        normalize(bEnd);


    if(aE <= aS){

        aE += 1440;

    }


    if(bE <= bS){

        bE += 1440;

    }


    return (
        aS < bE &&
        bS < aE
    );

}


// ================= SUPABASE BOOKED SLOTS =================

async function loadBookedSlots(date){

    bookedSlots = [];


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
            "get_booked_slots error:",
            error
        );

        showMessage(
            "حدث خطأ أثناء تحميل المواعيد. حاول مرة أخرى.",
            true
        );

        return false;

    }


    bookedSlots =
        Array.isArray(data)
            ? data
            : [];


    return true;

}


// ================= OCCUPIED =================

function isOccupied(
    start,
    duration
){

    const end =
        endTime(
            start,
            duration
        );


    return bookedSlots.some(
        booking => {

            return rangesOverlap(
                start,
                end,
                booking.start_time,
                booking.end_time
            );

        }
    );

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


    if(!date)
        return;


    document.getElementById(
        "selectedDateLabel"
    ).textContent =
        dateLabel(date);


    slotsEl.innerHTML = `

        <p class="muted">
            جاري تحميل المواعيد...
        </p>

    `;


    const success =
        await loadBookedSlots(
            date
        );


    if(!success){

        slotsEl.innerHTML = `

            <p class="muted">
                تعذر تحميل المواعيد.
            </p>

        `;

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
                            item => {

                                item.classList
                                    .remove(
                                        "selected"
                                    );

                            }
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


// ================= SUMMARY =================

function renderSummary(){

    if(!selectedSlot)
        return;


    const selectedType =
        document.querySelector(
            'input[name="bookingType"]:checked'
        );


    const type =
        selectedType
            ?
            selectedType.value
            :
            "single";


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
                            item => {

                                item.classList
                                    .remove(
                                        "active"
                                    );

                            }
                        );


                    const choice =
                        radio.closest(
                            ".choice"
                        );


                    if(choice){

                        choice.classList
                            .add(
                                "active"
                            );

                    }


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


// ================= INITIAL DATE =================

dateInput.value =
    futureDate(1);


dateInput.min =
    localISODate();


weeklyEndDate.min =
    dateInput.value;


// ================= DATE CHANGE =================

dateInput.addEventListener(
    "change",
    () => {

        weeklyEndDate.min =
            dateInput.value;

        renderSlots();

    }
);


// ================= DURATION CHANGE =================

durationInput.addEventListener(
    "change",
    renderSlots
);


// ================= SUBMIT BOOKING =================

bookingForm.addEventListener(
    "submit",
    async event => {

        event.preventDefault();


        if(!selectedSlot){

            showMessage(
                "اختار موعد الأول.",
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


        const selectedType =
            document.querySelector(
                'input[name="bookingType"]:checked'
            );


        const type =
            selectedType
                ?
                selectedType.value
                :
                "single";


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
            نعمل فحص جديد من Supabase
            قبل تسجيل الحجز.
        */

        showMessage(
            "جاري التأكد من توفر الموعد..."
        );


        const freshCheck =
            await loadBookedSlots(
                dateInput.value
            );


        if(!freshCheck){

            return;

        }


        if(
            isOccupied(
                selectedSlot.start,
                selectedSlot.duration
            )
        ){

            showMessage(
                "الموعد لم يعد متاحًا. اختار موعدًا آخر.",
                true
            );

            await renderSlots();

            return;

        }


        /*
            إعادة حساب السعر من الإعدادات
        */

        const price =
            priceFor(
                selectedSlot.start,
                selectedSlot.duration
            );


        showMessage(
            "جاري تسجيل الحجز..."
        );


        /*
            تجهيز البيانات بنفس أسماء
            أعمدة Supabase.
        */

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
                price,

            booking_type:
                type,

            weekly_end_date:
                endDate,

            status:
                "pending"

        };


const {
    error
} =
    await supabaseClient
        .from("bookings")
        .insert(
            bookingData
        );


        if(error){

            console.error(
                "Booking insert error:",
                error
            );


            showMessage(
                "حدث خطأ أثناء تسجيل الحجز: " +
                error.message,
                true
            );


            return;

        }


        /*
            الحجز اتسجل بنجاح.
        */

        showMessage(
            "تم تسجيل طلب الحجز بنجاح ✅ سيتم التواصل معك لتأكيد الموعد."
        );


        /*
            إرسال رسالة واتساب للمالك.
        */

        sendWhatsApp({
    ...bookingData
});


        /*
            تنظيف النموذج.
        */

        bookingForm.reset();


        selectedSlot =
            null;


        selectedSummary
            .classList
            .add("hidden");


        /*
            إعادة تحميل المواعيد.
        */

        await renderSlots();

    }
);


// ================= WHATSAPP =================

function sendWhatsApp(
    booking
){

    if(!booking)
        return;


    const owner =
        settings.ownerOne ||
        settings.ownerTwo ||
        "";


    if(!owner){

        console.warn(
            "No owner WhatsApp number configured."
        );

        return;

    }


    /*
        إزالة أي رموز غير الأرقام
    */

    const cleanOwner =
        String(owner)
            .replace(
                /\D/g,
                ""
            );


    if(!cleanOwner){

        console.warn(
            "Invalid owner WhatsApp number."
        );

        return;

    }


    const typeText =
        booking.booking_type === "weekly"
            ?
            "حجز أسبوعي متكرر"
            :
            "حجز لمرة واحدة";


    const durationText =
        Number(
            booking.duration_minutes
        ) === 60
            ?
            "ساعة"
            :
            Number(
                booking.duration_minutes
            ) === 90
                ?
                "ساعة ونصف"
                :
                "ساعتان";


    const message =

        `⚽ *طلب حجز جديد - ملعب العزيمة 14*` +

        `\n\n` +

        `👤 الاسم: ${booking.customer_name}` +

        `\n📱 الموبايل: ${booking.customer_phone}` +

        `\n📅 التاريخ: ${dateLabel(
            booking.booking_date
        )}` +

        `\n⏰ الموعد: ${minutesToTime(
            timeToMinutes(
                booking.start_time
            )
        )} - ${minutesToTime(
            timeToMinutes(
                booking.end_time
            )
        )}` +

        `\n⏱️ المدة: ${durationText}` +

        `\n💰 السعر: ${booking.price} جنيه` +

        `\n📌 النوع: ${typeText}` +

        (
            booking.booking_type === "weekly"
            ?
            `\n🔄 ينتهي في: ${dateLabel(
                booking.weekly_end_date
            )}`
            :
            ""
        ) +

        `\n\n🟡 الحالة: في انتظار التأكيد`;


    const url =
        "https://wa.me/" +
        cleanOwner +
        "?text=" +
        encodeURIComponent(
            message
        );


    /*
        فتح واتساب في تبويب جديد.
    */

    window.open(
        url,
        "_blank"
    );

}


// ================= START =================

async function init(){

    showMessage(
        "جاري تحميل المواعيد..."
    );


    await loadSettings();


    await renderSlots();


    /*
        نخفي رسالة التحميل
        بعد اكتمال البداية.
    */

    if(
        messageEl &&
        messageEl.textContent ===
        "جاري تحميل المواعيد..."
    ){

        messageEl.classList
            .add("hidden");

    }

}


init();
